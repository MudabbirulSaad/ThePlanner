import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson, syncTrackerDryRunUseCase } from "../../src/application/index.js";
import type {
  TrackerSyncAdapter,
  TrackerSyncPreviewInput
} from "../../src/application/index.js";

class FakeTrackerSyncAdapter implements TrackerSyncAdapter {
  public readonly tracker = "github";
  public input: TrackerSyncPreviewInput | undefined;
  public calls = 0;

  public preview(input: TrackerSyncPreviewInput) {
    this.calls += 1;
    this.input = input;

    return {
      issues: [
        {
          workItemId: "wi-001",
          title: "wi-001: Work",
          body: "Preview only.",
          labels: ["planner", "work-item"],
          dependencies: [],
          references: ["req-001"]
        }
      ]
    };
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
        title: "Work",
        execution_state: "backlog",
        readiness_snapshot: { graph_version: 1, labels: ["agent_eligible"], reasons: [] },
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

describe("tracker sync dry-run use case", () => {
  it("uses a tracker adapter to preview deterministic issues without applying changes", async () => {
    const trackerAdapter = new FakeTrackerSyncAdapter();

    const result = await syncTrackerDryRunUseCase({
      graphRepository: { load: async () => graph },
      trackerAdapter
    });

    expect(result).toEqual({
      status: "planned",
      tracker: "github",
      dryRun: true,
      applied: false,
      proposedIssues: [
        {
          workItemId: "wi-001",
          title: "wi-001: Work",
          body: "Preview only.",
          labels: ["planner", "work-item"],
          dependencies: [],
          references: ["req-001"]
        }
      ],
      message: "Dry run planned 1 github issue(s). No external tracker was mutated."
    });
    expect(trackerAdapter.calls).toBe(1);
    expect(trackerAdapter.input?.graph).toBe(graph);
  });
});
