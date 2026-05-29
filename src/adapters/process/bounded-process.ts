import { spawn } from "node:child_process";
import process from "node:process";

export interface BoundedProcessOptions {
  readonly command: readonly string[];
  readonly input?: string;
  readonly stdin?: "ignore" | "pipe";
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
  readonly timeoutErrorCode: string;
  readonly outputLimitErrorCode: string;
  readonly notFoundErrorCode: string;
  readonly spawnFailedErrorCode: string;
  readonly emptyCommandErrorCode: string;
  readonly emptyCommandMessage: string;
}

export interface BoundedProcessResult {
  readonly command: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output: {
    readonly stdoutBytes: number;
    readonly stderrBytes: number;
    readonly stdoutTruncated: boolean;
    readonly stderrTruncated: boolean;
    readonly outputLimitBytes: number;
  };
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

const killGraceMs = 250;

export async function runBoundedProcess(options: BoundedProcessOptions): Promise<BoundedProcessResult> {
  const [binary, ...processArgs] = options.command;
  if (!binary) {
    return {
      command: options.command,
      exitCode: 127,
      stdout: "",
      stderr: "",
      output: emptyOutput(options.outputLimitBytes),
      error: {
        code: options.emptyCommandErrorCode,
        message: options.emptyCommandMessage
      }
    };
  }

  return await new Promise<BoundedProcessResult>((resolve) => {
    const child = spawn(binary, processArgs, {
      cwd: process.cwd(),
      stdio: [options.stdin ?? "pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...options.env
      }
    });
    const stdout = createLimitedCapture("stdout", options.outputLimitBytes);
    const stderr = createLimitedCapture("stderr", options.outputLimitBytes);
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), killGraceMs);
    }, options.timeoutMs);

    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout.append(chunk);
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr.append(chunk);
      });
    }

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      const output = outputSummary(stdout, stderr, options.outputLimitBytes);
      const notFound = error.code === "ENOENT";
      resolve({
        command: options.command,
        exitCode: notFound ? 127 : 1,
        stdout: stdout.content(),
        stderr: stderr.content(),
        output,
        error: {
          code: notFound ? options.notFoundErrorCode : options.spawnFailedErrorCode,
          message: error.message
        }
      });
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      const output = outputSummary(stdout, stderr, options.outputLimitBytes);
      const outputTruncated = output.stdoutTruncated || output.stderrTruncated;
      resolve({
        command: options.command,
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout: stdout.content(),
        stderr: stderr.content(),
        output,
        ...(timedOut
          ? {
              error: {
                code: options.timeoutErrorCode,
                message: `Process timed out after ${options.timeoutMs}ms.`
              }
            }
          : outputTruncated
            ? {
                error: {
                  code: options.outputLimitErrorCode,
                  message: `Process output exceeded ${options.outputLimitBytes} bytes per stream.`
                }
              }
            : {})
      });
    });

    if ((options.stdin ?? "pipe") === "pipe" && child.stdin) {
      child.stdin.end(options.input ?? "");
    }
  });
}

export function splitCommand(command: string): readonly string[] {
  return command.match(/"[^"]+"|'[^']+'|\S+/gu)?.map((part) => part.replace(/^(['"])(.*)\1$/u, "$2")) ?? [];
}

function createLimitedCapture(stream: "stdout" | "stderr", outputLimitBytes: number): {
  readonly append: (chunk: string) => void;
  readonly content: () => string;
  readonly bytes: () => number;
  readonly truncated: () => boolean;
} {
  let content = "";
  let bytes = 0;
  let truncated = false;
  const marker = `\n[planner: ${stream} truncated after ${outputLimitBytes} bytes]\n`;

  return {
    append(chunk: string): void {
      if (truncated) {
        bytes += Buffer.byteLength(chunk);
        return;
      }

      const chunkBytes = Buffer.byteLength(chunk);
      bytes += chunkBytes;
      const remaining = outputLimitBytes - Buffer.byteLength(content);
      if (chunkBytes <= remaining) {
        content += chunk;
        return;
      }

      if (remaining > 0) {
        content += Buffer.from(chunk).subarray(0, remaining).toString("utf8");
      }
      content += marker;
      truncated = true;
    },
    content(): string {
      return content;
    },
    bytes(): number {
      return bytes;
    },
    truncated(): boolean {
      return truncated;
    }
  };
}

function outputSummary(
  stdout: ReturnType<typeof createLimitedCapture>,
  stderr: ReturnType<typeof createLimitedCapture>,
  outputLimitBytes: number
): BoundedProcessResult["output"] {
  return {
    stdoutBytes: stdout.bytes(),
    stderrBytes: stderr.bytes(),
    stdoutTruncated: stdout.truncated(),
    stderrTruncated: stderr.truncated(),
    outputLimitBytes
  };
}

function emptyOutput(outputLimitBytes: number): BoundedProcessResult["output"] {
  return {
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
    outputLimitBytes
  };
}
