import { describe, expect, it } from "vitest";

import {
  decideAgentRunUseCase,
  parsePlanningGraphJson,
  reviewAgentRunUseCase,
  runAgentUseCase
} from "../../src/application/index.js";
import type {
  AgentRunArtifactReader,
  AgentRunArtifactFile,
  AgentRunArtifactWriter,
  AgentRunner,
  AgentRunnerInput,
  AgentRunnerResult,
  ValidationCommandResult,
  ValidationCommandRunner,
  ValidationCommandRunnerInput,
  PlanningChangeLogEvent
} from "../../src/application/index.js";

class FakeArtifactWriter implements AgentRunArtifactWriter {
  public readonly files = new Map<string, string>();

  public async writeAll(files: readonly AgentRunArtifactFile[]): Promise<readonly string[]> {
    for (const file of files) {
      this.files.set(file.path, file.content);
    }

    return files.map((file) => file.path);
  }
}

class FakeArtifactReader implements AgentRunArtifactReader {
  public constructor(private readonly files: ReadonlyMap<string, string>) {}

  public async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`missing ${path}`);
    }

    return content;
  }
}

class FakeRunner implements AgentRunner {
  public input: AgentRunnerInput | undefined;

  public constructor(private readonly result: AgentRunnerResult) {}

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    this.input = input;
    return this.result;
  }
}

class FakeValidationRunner implements ValidationCommandRunner {
  public readonly inputs: ValidationCommandRunnerInput[] = [];

  public constructor(private readonly results: readonly ValidationCommandResult[]) {}

  public async run(input: ValidationCommandRunnerInput): Promise<ValidationCommandResult> {
    this.inputs.push(input);
    const result = this.results[this.inputs.length - 1];
    if (!result) {
      throw new Error(`Unexpected validation command: ${input.command}`);
    }
    return result;
  }
}

const graph = parsePlanningGraphJson({
  schema_version: "0.1.0",
  graph_version: 1,
  nodes: {
    requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
    work_items: [
      {
        id: "wi-001",
        title: "Run Codex",
        execution_state: "backlog",
        readiness_snapshot: { graph_version: 1, labels: ["agent_eligible", "afk_ready"], reasons: [] },
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
      }
    ],
    decisions: [],
    assumptions: [],
    risks: [],
    open_questions: [],
    hitl_gates: [],
    components: [],
    document_projections: [],
    execution_slices: []
  },
  edges: [{ source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." }]
});

describe("run agent use case", () => {
  it("runs a ready Work Item through a fake Codex runner and persists artifacts", async () => {
    const writer = new FakeArtifactWriter();
    const runner = new FakeRunner({
      command: ["codex"],
      exitCode: 0,
      stdout: "ok\n",
      stderr: ""
    });
    const validationRunner = new FakeValidationRunner([
      { command: "npm test", exitCode: 0, stdout: "tests passed\n", stderr: "" }
    ]);

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => "# Instructions\n" },
      runArtifactWriter: writer,
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      workItemId: "wi-001",
      agent: "codex",
      timestamp: "2026-05-29T12:34:56.000Z"
    });

    expect(result).toMatchObject({
      status: "completed",
      agent: "codex",
      workItemId: "wi-001",
      runId: "run-20260529-123456-wi-001",
      runDirectory: "planning/runs/run-20260529-123456-wi-001",
      runner: { command: ["codex"], exitCode: 0 },
      validation: { status: "pass", commands: [{ command: "npm test", exitCode: 0 }] }
    });
    expect(validationRunner.inputs).toEqual([
      {
        command: "npm test",
        workItemId: "wi-001",
        runId: "run-20260529-123456-wi-001",
        runDirectory: "planning/runs/run-20260529-123456-wi-001"
      }
    ]);
    expect(runner.input?.prompt).toContain("# Agent Context Bundle");
    expect(runner.input?.prompt).toContain("## Run Instructions");
    expect(runner.input?.prompt).toContain("Work Item: wi-001 - Run Codex");
    expect(runner.input?.prompt).not.toContain("Do not execute an autonomous agent from theplanner prepare.");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/prompt.md")).toContain("# Agent Context Bundle");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/runner-stdout.log")).toBe("ok\n");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/validation-stdout.log")).toBe("tests passed\n");
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/metadata.json") ?? "{}")).toMatchObject({
      validation: { status: "pass", commands: [{ command: "npm test", exitCode: 0 }] }
    });
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}")).toMatchObject({
      status: "completed",
      runner: { exitCode: 0 },
      validation: { status: "pass" }
    });
  });

  it("persists failed validation output and returns a failed result", async () => {
    const writer = new FakeArtifactWriter();
    const runner = new FakeRunner({
      command: ["codex"],
      exitCode: 0,
      stdout: "ok\n",
      stderr: ""
    });
    const validationRunner = new FakeValidationRunner([
      { command: "npm test", exitCode: 1, stdout: "one failed\n", stderr: "failure details\n" }
    ]);

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: writer,
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      workItemId: "wi-001",
      agent: "codex",
      timestamp: "2026-05-29T12:34:56.000Z"
    });

    expect(result).toMatchObject({
      status: "failed",
      runner: { exitCode: 0 },
      validation: { status: "fail", commands: [{ command: "npm test", exitCode: 1 }] }
    });
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/validation-stdout.log")).toBe("one failed\n");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/validation-stderr.log")).toBe("failure details\n");
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}")).toMatchObject({
      status: "failed",
      validation: { status: "fail", commands: [{ command: "npm test", exitCode: 1 }] }
    });
  });

  it("persists failed runner output and returns a useful failed result", async () => {
    const writer = new FakeArtifactWriter();
    const runner = new FakeRunner({
      command: ["codex"],
      exitCode: 127,
      stdout: "",
      stderr: "",
      error: {
        code: "runner_not_found",
        message: "Codex runner command not found: codex"
      }
    });
    const validationRunner = new FakeValidationRunner([
      { command: "npm test", exitCode: 0, stdout: "tests passed\n", stderr: "" }
    ]);

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: writer,
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      workItemId: "wi-001",
      agent: "codex",
      timestamp: "2026-05-29T12:34:56.000Z"
    });

    expect(result).toMatchObject({
      status: "failed",
      runner: {
        exitCode: 127,
        error: {
          code: "runner_not_found",
          message: "Codex runner command not found: codex"
        }
      }
    });
    expect(validationRunner.inputs).toHaveLength(1);
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}")).toMatchObject({
      status: "failed",
      runner: { exitCode: 127, error: { code: "runner_not_found" } },
      validation: { status: "pass" }
    });
  });

  it("persists process output summaries in run result JSON", async () => {
    const writer = new FakeArtifactWriter();
    const runner = new FakeRunner({
      command: ["codex"],
      exitCode: 0,
      stdout: "abcdefghij\n[planner: stdout truncated after 10 bytes]\n",
      stderr: "",
      output: {
        stdoutBytes: 26,
        stderrBytes: 0,
        stdoutTruncated: true,
        stderrTruncated: false,
        outputLimitBytes: 10
      },
      error: {
        code: "runner_output_limit_exceeded",
        message: "Process output exceeded 10 bytes per stream."
      }
    });
    const validationRunner = new FakeValidationRunner([
      {
        command: "npm test",
        exitCode: 0,
        stdout: "",
        stderr: "abcdefghijkl\n[planner: stderr truncated after 12 bytes]\n",
        output: {
          stdoutBytes: 0,
          stderrBytes: 26,
          stdoutTruncated: false,
          stderrTruncated: true,
          outputLimitBytes: 12
        },
        error: {
          code: "validation_command_output_limit_exceeded",
          message: "Process output exceeded 12 bytes per stream."
        }
      }
    ]);

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: writer,
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      workItemId: "wi-001",
      agent: "codex",
      timestamp: "2026-05-29T12:34:56.000Z"
    });

    const resultJson = JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}");

    expect(result).toMatchObject({
      status: "failed",
      runner: { output: { stdoutTruncated: true }, error: { code: "runner_output_limit_exceeded" } },
      validation: {
        status: "fail",
        commands: [{ output: { stderrTruncated: true }, error: { code: "validation_command_output_limit_exceeded" } }]
      }
    });
    expect(resultJson).toMatchObject({
      runner: { output: { stdoutBytes: 26, stdoutTruncated: true, outputLimitBytes: 10 } },
      validation: {
        commands: [{ output: { stderrBytes: 26, stderrTruncated: true, outputLimitBytes: 12 } }]
      }
    });
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/runner-stdout.log")).toContain(
      "[planner: stdout truncated after 10 bytes]"
    );
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/validation-stderr.log")).toContain(
      "[planner: stderr truncated after 12 bytes]"
    );
  });

  it("summarizes a saved run for human review", async () => {
    const reader = new FakeArtifactReader(savedRunArtifacts());

    const result = await reviewAgentRunUseCase({
      graphRepository: { load: async () => graph },
      runArtifactReader: reader,
      runId: "run-20260529-123456-wi-001"
    });

    expect(result).toMatchObject({
      status: "ready_for_review",
      runId: "run-20260529-123456-wi-001",
      runDirectory: "planning/runs/run-20260529-123456-wi-001",
      workItem: { id: "wi-001", title: "Run Codex" },
      runner: { command: ["codex"], exitCode: 0 },
      changedFiles: ["src/example.ts", "tests/example.test.ts"],
      validation: { status: "pass", commands: [{ command: "npm test", exitCode: 0 }] },
      artifacts: [
        "planning/runs/run-20260529-123456-wi-001/metadata.json",
        "planning/runs/run-20260529-123456-wi-001/result.json"
      ]
    });
  });

  it("appends an accepted run decision without changing Work Item state", async () => {
    let event: PlanningChangeLogEvent | undefined;

    const result = await decideAgentRunUseCase({
      graphRepository: { load: async () => graph },
      runArtifactReader: new FakeArtifactReader(savedRunArtifacts()),
      changeLogWriter: { append: async (nextEvent) => { event = nextEvent; } },
      runId: "run-20260529-123456-wi-001",
      decision: "accepted",
      timestamp: "2026-05-29T13:00:00.000Z"
    });

    expect(result).toMatchObject({
      status: "accepted",
      runId: "run-20260529-123456-wi-001",
      workItemId: "wi-001",
      message: "Accepted run run-20260529-123456-wi-001. No Work Item state was changed automatically."
    });
    expect(event).toMatchObject({
      graph_version_before: 1,
      graph_version_after: 1,
      actor: "human",
      operation_type: "agent_run_accepted",
      affected_node_ids: ["wi-001"],
      approval_status: "accepted",
      provenance_reference: "planning/runs/run-20260529-123456-wi-001/result.json"
    });
  });

  it("appends a rejected run decision", async () => {
    let event: PlanningChangeLogEvent | undefined;

    const result = await decideAgentRunUseCase({
      graphRepository: { load: async () => graph },
      runArtifactReader: new FakeArtifactReader(savedRunArtifacts()),
      changeLogWriter: { append: async (nextEvent) => { event = nextEvent; } },
      runId: "run-20260529-123456-wi-001",
      decision: "rejected",
      timestamp: "2026-05-29T13:00:00.000Z"
    });

    expect(result.status).toBe("rejected");
    expect(event).toMatchObject({
      operation_type: "agent_run_rejected",
      affected_node_ids: ["wi-001"],
      approval_status: "rejected",
      summary: "Rejected agent run run-20260529-123456-wi-001 for Work Item wi-001."
    });
  });

  it("rejects invalid run ids before reading artifacts", async () => {
    await expect(
      reviewAgentRunUseCase({
        graphRepository: { load: async () => graph },
        runArtifactReader: new FakeArtifactReader(new Map()),
        runId: "../bad"
      })
    ).rejects.toThrow("Invalid run id: ../bad");
  });
});

function savedRunArtifacts(): ReadonlyMap<string, string> {
  const runDirectory = "planning/runs/run-20260529-123456-wi-001";
  const metadata = {
    runId: "run-20260529-123456-wi-001",
    workItemId: "wi-001",
    graphVersion: 1,
    agent: "codex",
    generatedAt: "2026-05-29T12:34:56.000Z",
    validationCommands: ["npm test"],
    validation: { status: "pass", commands: [{ command: "npm test", exitCode: 0 }] }
  };
  const result = {
    status: "completed",
    runId: "run-20260529-123456-wi-001",
    runner: { command: ["codex"], exitCode: 0 },
    validation: metadata.validation,
    changedFiles: ["src/example.ts", "tests/example.test.ts"],
    artifactPaths: [`${runDirectory}/metadata.json`, `${runDirectory}/result.json`]
  };

  return new Map([
    [`${runDirectory}/metadata.json`, `${JSON.stringify(metadata, null, 2)}\n`],
    [`${runDirectory}/result.json`, `${JSON.stringify(result, null, 2)}\n`]
  ]);
}
