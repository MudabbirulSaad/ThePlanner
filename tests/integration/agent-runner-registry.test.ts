import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AgentRunnerRegistry, ClaudeProcessRunner, CodexProcessRunner } from "../../src/adapters/index.js";
import type { AgentRunner, AgentRunnerInput, AgentRunnerResult } from "../../src/application/index.js";

class FakeRunner implements AgentRunner {
  public input: AgentRunnerInput | undefined;

  public constructor(private readonly result: AgentRunnerResult) {}

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    this.input = input;
    return this.result;
  }
}

const baseInput: AgentRunnerInput = {
  agent: "claude",
  workItemId: "wi-001",
  runId: "run-20260529-123456-wi-001",
  prompt: "# Prompt\n",
  runDirectory: "planning/runs/run-20260529-123456-wi-001"
};

describe("agent runner registry", () => {
  it("selects the configured fake runner for the requested agent", async () => {
    const codex = new FakeRunner({ command: ["codex"], exitCode: 0, stdout: "codex\n", stderr: "" });
    const claude = new FakeRunner({ command: ["claude"], exitCode: 0, stdout: "claude\n", stderr: "" });
    const gemini = new FakeRunner({ command: ["gemini"], exitCode: 0, stdout: "gemini\n", stderr: "" });
    const registry = new AgentRunnerRegistry({ codex, claude, gemini });

    const result = await registry.run(baseInput);

    expect(result).toMatchObject({ command: ["claude"], stdout: "claude\n" });
    expect(claude.input?.agent).toBe("claude");
    expect(codex.input).toBeUndefined();
    expect(gemini.input).toBeUndefined();
  });

  it("returns an explicit error when a requested runner is not configured", async () => {
    const registry = new AgentRunnerRegistry({});

    const result = await registry.run({ ...baseInput, agent: "gemini" });

    expect(result).toEqual({
      command: [],
      exitCode: 127,
      stdout: "",
      stderr: "",
      error: {
        code: "runner_not_configured",
        message: "Gemini CLI runner is not configured."
      }
    });
  });

  it("returns a clear missing-binary error for a configured process runner", async () => {
    const runner = new ClaudeProcessRunner("__planner_missing_claude_binary__");

    const result = await runner.run(baseInput);

    expect(result).toMatchObject({
      command: ["__planner_missing_claude_binary__"],
      exitCode: 127,
      error: {
        code: "runner_not_found",
        message: "Claude Code runner command not found: __planner_missing_claude_binary__"
      }
    });
  });

  it("checks Codex auth before running the agent command", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "planner-codex-auth-"));
    const command = join(workspace, "codex");
    await writeFile(
      command,
      [
        "#!/usr/bin/env sh",
        "if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then",
        "  echo \"Not logged in\" >&2",
        "  exit 1",
        "fi",
        "echo \"agent should not run\"",
        "exit 0",
        ""
      ].join("\n")
    );
    await chmod(command, 0o755);
    const runner = new CodexProcessRunner(command);

    const result = await runner.run({ ...baseInput, agent: "codex" });

    expect(result).toMatchObject({
      command: [command, "login", "status"],
      exitCode: 1,
      stdout: "",
      stderr: "Not logged in\n",
      error: {
        code: "runner_auth_failed",
        message: "Codex auth check failed. Run \"codex login\" before planner run."
      }
    });
  });

  it("runs Codex after a successful auth check with command arguments", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "planner-codex-auth-pass-"));
    const command = join(workspace, "codex");
    await writeFile(
      command,
      [
        "#!/usr/bin/env sh",
        "if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then",
        "  echo \"Logged in\"",
        "  exit 0",
        "fi",
        "printf '%s\\n' \"$@\"",
        "cat",
        ""
      ].join("\n")
    );
    await chmod(command, 0o755);
    const runner = new CodexProcessRunner(`${command} exec -`);

    const result = await runner.run({ ...baseInput, agent: "codex", prompt: "# Codex prompt\n" });

    expect(result).toMatchObject({
      command: [command, "exec", "-"],
      exitCode: 0,
      stderr: ""
    });
    expect(result.stdout).toContain("exec\n-\n# Codex prompt\n");
  });
});
