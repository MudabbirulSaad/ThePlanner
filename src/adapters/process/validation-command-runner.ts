import type {
  ValidationCommandResult,
  ValidationCommandRunner,
  ValidationCommandRunnerInput
} from "../../application/index.js";
import { defaultProcessOutputLimitBytes } from "./codex-runner.js";
import { runBoundedProcess, splitCommand } from "./bounded-process.js";

export interface ProcessValidationCommandRunnerOptions {
  readonly timeoutMs?: number;
  readonly outputLimitBytes?: number;
}

export class ProcessValidationCommandRunner implements ValidationCommandRunner {
  private readonly timeoutMs: number;
  private readonly outputLimitBytes: number;

  public constructor(options?: ProcessValidationCommandRunnerOptions) {
    this.timeoutMs = options?.timeoutMs ?? defaultValidationCommandTimeoutMs;
    this.outputLimitBytes = options?.outputLimitBytes ?? defaultProcessOutputLimitBytes;
  }

  public async run(input: ValidationCommandRunnerInput): Promise<ValidationCommandResult> {
    const command = splitCommand(input.command);
    const [binary] = command;
    if (!binary) {
      return {
        command: input.command,
        exitCode: 127,
        stdout: "",
        stderr: "",
        output: {
          stdoutBytes: 0,
          stderrBytes: 0,
          stdoutTruncated: false,
          stderrTruncated: false,
          outputLimitBytes: this.outputLimitBytes
        },
        error: {
          code: "validation_command_not_configured",
          message: "Validation command is empty."
        }
      };
    }

    const result = await runBoundedProcess({
      command,
      stdin: "ignore",
      timeoutMs: this.timeoutMs,
      outputLimitBytes: this.outputLimitBytes,
      timeoutErrorCode: "validation_command_timeout",
      outputLimitErrorCode: "validation_command_output_limit_exceeded",
      notFoundErrorCode: "validation_command_not_found",
      spawnFailedErrorCode: "validation_command_spawn_failed",
      emptyCommandErrorCode: "validation_command_not_configured",
      emptyCommandMessage: "Validation command is empty.",
      env: {
        PLANNER_RUN_ID: input.runId,
        PLANNER_WORK_ITEM_ID: input.workItemId,
        PLANNER_RUN_DIRECTORY: input.runDirectory
      }
    });

    return {
      ...result,
      command: input.command,
      ...(result.error?.code === "validation_command_not_found"
        ? {
            error: {
              code: "validation_command_not_found",
              message: `Validation command not found: ${binary}`
            }
          }
        : {})
    };
  }
}

export const defaultValidationCommandTimeoutMs = 10 * 60 * 1000;
