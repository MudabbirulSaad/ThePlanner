import process from "node:process";

import type { AgentRunner, AgentRunnerInput, AgentRunnerResult, SupportedAgent } from "../../application/index.js";
import { runBoundedProcess, splitCommand } from "./bounded-process.js";

export class AgentRunnerRegistry implements AgentRunner {
  public constructor(private readonly runners: Readonly<Partial<Record<SupportedAgent, AgentRunner>>>) {}

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    const runner = this.runners[input.agent];
    if (!runner) {
      return {
        command: [],
        exitCode: 127,
        stdout: "",
        stderr: "",
        error: {
          code: "runner_not_configured",
          message: `${agentDisplayName(input.agent)} runner is not configured.`
        }
      };
    }

    return await runner.run(input);
  }
}

export interface AgentProcessRunnerOptions {
  readonly displayName: string;
  readonly command: string;
  readonly authCheckCommand?: readonly string[];
  readonly timeoutMs?: number;
  readonly outputLimitBytes?: number;
}

export class AgentProcessRunner implements AgentRunner {
  private readonly command: readonly string[];
  private readonly displayName: string;
  private readonly authCheckCommand: readonly string[] | undefined;
  private readonly timeoutMs: number;
  private readonly outputLimitBytes: number;

  public constructor(options: AgentProcessRunnerOptions) {
    this.displayName = options.displayName;
    this.command = splitCommand(options.command);
    this.authCheckCommand = options.authCheckCommand;
    this.timeoutMs = options.timeoutMs ?? defaultAgentRunnerTimeoutMs;
    this.outputLimitBytes = options.outputLimitBytes ?? defaultProcessOutputLimitBytes;
  }

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    if (this.authCheckCommand) {
      const authCheck = await runAuthCheck({
        command: this.authCheckCommand,
        displayName: this.displayName,
        timeoutMs: this.timeoutMs,
        outputLimitBytes: this.outputLimitBytes
      });
      if (authCheck) {
        return authCheck;
      }
    }

    return await runProcessAgent({
      command: this.command,
      displayName: this.displayName,
      input,
      timeoutMs: this.timeoutMs,
      outputLimitBytes: this.outputLimitBytes
    });
  }
}

export class CodexProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_CODEX_COMMAND ?? "codex exec -", options?: ProcessRunnerLimitOptions) {
    super({ displayName: "Codex", command, authCheckCommand: createCodexAuthCheckCommand(command), ...options });
  }
}

export class ClaudeProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_CLAUDE_COMMAND ?? "claude", options?: ProcessRunnerLimitOptions) {
    super({ displayName: "Claude Code", command, ...options });
  }
}

export class GeminiProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_GEMINI_COMMAND ?? "gemini", options?: ProcessRunnerLimitOptions) {
    super({ displayName: "Gemini CLI", command, ...options });
  }
}

async function runAuthCheck(args: {
  readonly command: readonly string[];
  readonly displayName: string;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
}): Promise<AgentRunnerResult | undefined> {
  const [binary] = args.command;
  if (!binary) {
    return undefined;
  }

  const result = await runProcess({
    command: args.command,
    input: "",
    timeoutMs: args.timeoutMs,
    outputLimitBytes: args.outputLimitBytes
  });
  if (result.exitCode === 0 && !result.error) {
    return undefined;
  }

  if (
    result.error?.code === "runner_not_found" ||
    result.error?.code === "runner_timeout" ||
    result.error?.code === "runner_output_limit_exceeded"
  ) {
    return {
      ...result,
      ...(result.error.code === "runner_not_found"
        ? {
            error: {
              code: "runner_not_found",
              message: `${args.displayName} runner command not found: ${binary}`
            }
          }
        : {})
    };
  }

  return {
    ...result,
    error: {
      code: "runner_auth_failed",
      message: `${args.displayName} auth check failed. Run "codex login" before planner run.`
    }
  };
}

async function runProcessAgent(args: {
  readonly command: readonly string[];
  readonly displayName: string;
  readonly input: AgentRunnerInput;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
}): Promise<AgentRunnerResult> {
  const [binary] = args.command;
  if (!binary) {
    return {
      command: args.command,
      exitCode: 127,
      stdout: "",
      stderr: "",
      output: {
        stdoutBytes: 0,
        stderrBytes: 0,
        stdoutTruncated: false,
        stderrTruncated: false,
        outputLimitBytes: args.outputLimitBytes
      },
      error: {
        code: "runner_not_configured",
        message: `${args.displayName} runner command is empty.`
      }
    };
  }

  const result = await runProcess({
    command: args.command,
    input: args.input.prompt,
    timeoutMs: args.timeoutMs,
    outputLimitBytes: args.outputLimitBytes,
    env: {
      PLANNER_AGENT: args.input.agent,
      PLANNER_RUN_ID: args.input.runId,
      PLANNER_WORK_ITEM_ID: args.input.workItemId,
      PLANNER_RUN_DIRECTORY: args.input.runDirectory
    }
  });
  if (result.error?.code === "runner_not_found") {
    return {
      ...result,
      error: {
        code: "runner_not_found",
        message: `${args.displayName} runner command not found: ${binary}`
      }
    };
  }

  return result;
}

export interface LocalAgentRunnerOptions {
  readonly commandOverride?: string;
  readonly commands?: Partial<Record<SupportedAgent, string>>;
  readonly timeoutMs?: number;
  readonly outputLimitBytes?: number;
}

export function createLocalAgentRunner(options?: string | LocalAgentRunnerOptions): AgentRunner {
  const commandOverride = typeof options === "string" ? options : options?.commandOverride;
  const commands = typeof options === "string" ? undefined : options?.commands;
  const limitOptions =
    typeof options === "string"
      ? undefined
      : {
          timeoutMs: options?.timeoutMs,
          outputLimitBytes: options?.outputLimitBytes
        };

  return new AgentRunnerRegistry({
    codex: new CodexProcessRunner(commandOverride ?? commands?.codex, limitOptions),
    claude: new ClaudeProcessRunner(commandOverride ?? commands?.claude, limitOptions),
    gemini: new GeminiProcessRunner(commandOverride ?? commands?.gemini, limitOptions)
  });
}

function agentDisplayName(agent: SupportedAgent): string {
  return {
    codex: "Codex",
    claude: "Claude Code",
    gemini: "Gemini CLI"
  }[agent];
}

function createCodexAuthCheckCommand(command: string): readonly string[] | undefined {
  const [binary] = splitCommand(command);
  if (!binary || commandBasename(binary) !== "codex") {
    return undefined;
  }

  return [binary, "login", "status"];
}

function commandBasename(command: string): string {
  return command.split(/[\\/]/u).pop() ?? command;
}

async function runProcess(args: {
  readonly command: readonly string[];
  readonly input: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
}): Promise<AgentRunnerResult> {
  return await runBoundedProcess({
    command: args.command,
    input: args.input,
    env: args.env,
    timeoutMs: args.timeoutMs,
    outputLimitBytes: args.outputLimitBytes,
    timeoutErrorCode: "runner_timeout",
    outputLimitErrorCode: "runner_output_limit_exceeded",
    notFoundErrorCode: "runner_not_found",
    spawnFailedErrorCode: "runner_spawn_failed",
    emptyCommandErrorCode: "runner_not_configured",
    emptyCommandMessage: "Runner command is empty."
  });
}

interface ProcessRunnerLimitOptions {
  readonly timeoutMs?: number;
  readonly outputLimitBytes?: number;
}

export const defaultAgentRunnerTimeoutMs = 30 * 60 * 1000;
export const defaultProcessOutputLimitBytes = 1024 * 1024;
