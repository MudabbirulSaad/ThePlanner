import { spawn } from "node:child_process";
import process from "node:process";

import type { AgentRunner, AgentRunnerInput, AgentRunnerResult } from "../../application/index.js";

export class CodexProcessRunner implements AgentRunner {
  private readonly command: readonly string[];

  public constructor(command = process.env.PLANNER_CODEX_COMMAND ?? "codex") {
    this.command = splitCommand(command);
  }

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    const [binary, ...args] = this.command;
    if (!binary) {
      return {
        command: this.command,
        exitCode: 127,
        stdout: "",
        stderr: "",
        error: {
          code: "runner_not_configured",
          message: "Codex runner command is empty."
        }
      };
    }

    return await new Promise<AgentRunnerResult>((resolve) => {
      const child = spawn(binary, args, {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PLANNER_RUN_ID: input.runId,
          PLANNER_WORK_ITEM_ID: input.workItemId,
          PLANNER_RUN_DIRECTORY: input.runDirectory
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
          command: this.command,
          exitCode: notFound ? 127 : 1,
          stdout,
          stderr,
          error: {
            code: notFound ? "runner_not_found" : "runner_spawn_failed",
            message: notFound ? `Codex runner command not found: ${binary}` : error.message
          }
        });
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          command: this.command,
          exitCode: code ?? 1,
          stdout,
          stderr
        });
      });

      child.stdin.end(input.prompt);
    });
  }
}

function splitCommand(command: string): readonly string[] {
  return command.match(/"[^"]+"|'[^']+'|\S+/gu)?.map((part) => part.replace(/^(['"])(.*)\1$/u, "$2")) ?? [];
}
