import { describe, expect, it } from "vitest";

import {
  createChangeLogEvent,
  parsePlanningGraphJson,
  reconcileGraphUseCase
} from "../../src/application/index.js";
import { renderWorkItemProjection } from "../../src/core/index.js";
import type { PlanningChangeLogEvent } from "../../src/application/index.js";
import type { PlanningGraph } from "../../src/core/index.js";

function fixtureGraph(): PlanningGraph {
  return parsePlanningGraphJson({
    schema_version: "0.1.0",
    graph_version: 1,
    nodes: {
      requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
      decisions: [],
      assumptions: [],
      risks: [],
      open_questions: [],
      hitl_gates: [],
      components: [],
      work_items: [
        {
          id: "wi-001",
          title: "Work item",
          execution_state: "backlog",
          readiness_snapshot: { graph_version: 1, labels: ["agent_eligible", "afk_ready"], reasons: [] },
          acceptance_criteria: ["First criterion"],
          validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
        }
      ],
      document_projections: [],
      execution_slices: []
    },
    edges: [{ source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." }]
  });
}

describe("reconcile graph use case and planning change log", () => {
  it("does not mutate the graph without apply", async () => {
    const graph = fixtureGraph();
    let saved: PlanningGraph | undefined;
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    const result = await reconcileGraphUseCase({
      graphRepository: { load: async () => graph, save: async (next) => { saved = next; } },
      projectionReader: {
        readMany: async () => [
          { ...projection, content: projection.content.replace("title: Work item", "title: Renamed work item") }
        ]
      },
      changeLogWriter: { append: async () => undefined },
      apply: false
    });

    expect(result.applied).toBe(false);
    expect(result.proposedPatches).toHaveLength(1);
    expect(saved).toBeUndefined();
  });

  it("applies safe reconciliation patches and writes a change-log event", async () => {
    const graph = fixtureGraph();
    let saved: PlanningGraph | undefined;
    let event: PlanningChangeLogEvent | undefined;
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    const result = await reconcileGraphUseCase({
      graphRepository: { load: async () => graph, save: async (next) => { saved = next; } },
      projectionReader: {
        readMany: async () => [
          { ...projection, content: projection.content.replace("title: Work item", "title: Renamed work item") }
        ]
      },
      changeLogWriter: { append: async (nextEvent) => { event = nextEvent; } },
      apply: true,
      timestamp: "2026-05-29T00:00:00+10:00"
    });

    expect(result.applied).toBe(true);
    expect(saved?.graphVersion).toBe(2);
    expect(event).toMatchObject({
      graph_version_before: 1,
      graph_version_after: 2,
      affected_node_ids: ["wi-001"],
      summary: "Applied 1 safe reconciliation patch(es)."
    });
  });

  it("does not save the graph when change-log writing fails", async () => {
    const graph = fixtureGraph();
    let saved: PlanningGraph | undefined;
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    await expect(
      reconcileGraphUseCase({
        graphRepository: { load: async () => graph, save: async (next) => { saved = next; } },
        projectionReader: {
          readMany: async () => [
            { ...projection, content: projection.content.replace("title: Work item", "title: Renamed work item") }
          ]
        },
        changeLogWriter: { append: async () => { throw new Error("disk full"); } },
        apply: true
      })
    ).rejects.toThrow("disk full");

    expect(saved).toBeUndefined();
  });

  it("creates valid NDJSON event payload fields", () => {
    const event = createChangeLogEvent({
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      affectedNodeIds: ["wi-001"],
      actor: "planner",
      timestamp: "2026-05-29T00:00:00+10:00",
      operationType: "slice_completion",
      approvalStatus: "validated_complete",
      summary: "Marked work complete.",
      provenanceReference: "test"
    });

    expect(`${JSON.stringify(event)}\n`.trim().split("\n")).toHaveLength(1);
    expect(event).toMatchObject({
      event_id: "evt-20260529000000-2",
      graph_version_before: 1,
      graph_version_after: 2,
      affected_node_ids: ["wi-001"],
      summary: "Marked work complete."
    });
  });
});
