import { spawn } from "node:child_process";
import process from "node:process";

import type {
  ValidationCommandResult,
  ValidationCommandRunner,
  ValidationCommandRunnerInput
} from "../../application/index.js";

export class ProcessValidationCommandRunner implements ValidationCommandRunner {
  public async run(input: ValidationCommandRunnerInput): Promise<ValidationCommandResult> {
    const [binary, ...args] = splitCommand(input.command);
    if (!binary) {
      return {
        command: input.command,
        exitCode: 127,
        stdout: "",
        stderr: "",
        error: {
          code: "validation_command_not_configured",
          message: "Validation command is empty."
        }
      };
    }

    return await new Promise<ValidationCommandResult>((resolve) => {
      const child = spawn(binary, args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
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
          command: input.command,
          exitCode: notFound ? 127 : 1,
          stdout,
          stderr,
          error: {
            code: notFound ? "validation_command_not_found" : "validation_command_spawn_failed",
            message: notFound ? `Validation command not found: ${binary}` : error.message
          }
        });
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({
          command: input.command,
          exitCode: code ?? 1,
          stdout,
          stderr
        });
      });
    });
  }
}

function splitCommand(command: string): readonly string[] {
  return command.match(/"[^"]+"|'[^']+'|\S+/gu)?.map((part) => part.replace(/^(['"])(.*)\1$/u, "$2")) ?? [];
}
