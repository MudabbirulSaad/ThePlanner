import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson, runAgentUseCase } from "../../src/application/index.js";
import type {
  AgentRunArtifactFile,
  AgentRunArtifactWriter,
  AgentRunner,
  AgentRunnerInput,
  AgentRunnerResult
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

class FakeRunner implements AgentRunner {
  public input: AgentRunnerInput | undefined;

  public constructor(private readonly result: AgentRunnerResult) {}

  public async run(input: AgentRunnerInput): Promise<AgentRunnerResult> {
    this.input = input;
    return this.result;
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

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => "# Instructions\n" },
      runArtifactWriter: writer,
      agentRunner: runner,
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
      runner: { command: ["codex"], exitCode: 0 }
    });
    expect(runner.input?.prompt).toContain("# Agent Context Bundle");
    expect(runner.input?.prompt).toContain("## Run Instructions");
    expect(runner.input?.prompt).toContain("Work Item: wi-001 - Run Codex");
    expect(runner.input?.prompt).not.toContain("Do not execute an autonomous agent from planner prepare.");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/prompt.md")).toContain("# Agent Context Bundle");
    expect(writer.files.get("planning/runs/run-20260529-123456-wi-001/runner-stdout.log")).toBe("ok\n");
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}")).toMatchObject({
      status: "completed",
      runner: { exitCode: 0 }
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

    const result = await runAgentUseCase({
      graphRepository: { load: async () => graph },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: writer,
      agentRunner: runner,
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
    expect(JSON.parse(writer.files.get("planning/runs/run-20260529-123456-wi-001/result.json") ?? "{}")).toMatchObject({
      status: "failed",
      runner: { exitCode: 127, error: { code: "runner_not_found" } }
    });
  });
});
