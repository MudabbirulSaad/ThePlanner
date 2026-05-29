import { spawn } from "node:child_process";
import process from "node:process";

import type { AgentRunner, AgentRunnerInput, AgentRunnerResult, SupportedAgent } from "../../application/index.js";

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
}

export class AgentProcessRunner implements AgentRunner {
  private readonly command: readonly string[];
  private readonly displayName: string;
  private readonly authCheckCommand: readonly string[] | undefined;

  public constructor(options: AgentProcessRunnerOptions) {
    this.displayName = options.displayName;
    this.command = splitCommand(options.command);
    this.authCheckCommand = options.authCheckCommand;
  }

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    if (this.authCheckCommand) {
      const authCheck = await runAuthCheck({
        command: this.authCheckCommand,
        displayName: this.displayName
      });
      if (authCheck) {
        return authCheck;
      }
    }

    return await runProcessAgent({
      command: this.command,
      displayName: this.displayName,
      input
    });
  }
}

export class CodexProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_CODEX_COMMAND ?? "codex exec -") {
    super({ displayName: "Codex", command, authCheckCommand: createCodexAuthCheckCommand(command) });
  }
}

export class ClaudeProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_CLAUDE_COMMAND ?? "claude") {
    super({ displayName: "Claude Code", command });
  }
}

export class GeminiProcessRunner extends AgentProcessRunner {
  public constructor(command = process.env.PLANNER_GEMINI_COMMAND ?? "gemini") {
    super({ displayName: "Gemini CLI", command });
  }
}

async function runAuthCheck(args: {
  readonly command: readonly string[];
  readonly displayName: string;
}): Promise<AgentRunnerResult | undefined> {
  const [binary] = args.command;
  if (!binary) {
    return undefined;
  }

  const result = await runProcess({
    command: args.command,
    input: ""
  });
  if (result.exitCode === 0 && !result.error) {
    return undefined;
  }

  if (result.error?.code === "runner_not_found") {
    return {
      ...result,
      error: {
        code: "runner_not_found",
        message: `${args.displayName} runner command not found: ${binary}`
      }
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
}): Promise<AgentRunnerResult> {
  const [binary] = args.command;
  if (!binary) {
    return {
      command: args.command,
      exitCode: 127,
      stdout: "",
      stderr: "",
      error: {
        code: "runner_not_configured",
        message: `${args.displayName} runner command is empty.`
      }
    };
  }

  const result = await runProcess({
    command: args.command,
    input: args.input.prompt,
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

export function createLocalAgentRunner(commandOverride?: string): AgentRunner {
  return new AgentRunnerRegistry({
    codex: new CodexProcessRunner(commandOverride),
    claude: new ClaudeProcessRunner(commandOverride),
    gemini: new GeminiProcessRunner(commandOverride)
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
}): Promise<AgentRunnerResult> {
  const [binary, ...processArgs] = args.command;
  if (!binary) {
    return {
      command: args.command,
      exitCode: 127,
      stdout: "",
      stderr: "",
      error: {
        code: "runner_not_configured",
        message: "Runner command is empty."
      }
    };
  }

  return await new Promise<AgentRunnerResult>((resolve) => {
    const child = spawn(binary, processArgs, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...args.env
      }
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      settled = true;
      const notFound = error.code === "ENOENT";
      resolve({
        command: args.command,
        exitCode: notFound ? 127 : 1,
        stdout,
        stderr,
        error: {
          code: notFound ? "runner_not_found" : "runner_spawn_failed",
          message: error.message
        }
      });
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        command: args.command,
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });

    child.stdin.end(args.input);
  });
}

function splitCommand(command: string): readonly string[] {
  return command.match(/"[^"]+"|'[^']+'|\S+/gu)?.map((part) => part.replace(/^(['"])(.*)\1$/u, "$2")) ?? [];
}
