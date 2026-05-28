import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import {
  applyGraphPatches,
  reconcileGraphProjections,
  renderWorkItemProjection
} from "../../src/core/index.js";
import type { PlanningNode, WorkItemNode } from "../../src/core/index.js";

const graph = parsePlanningGraphJson({
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
      },
      {
        id: "wi-002",
        title: "Dependency",
        execution_state: "done",
        readiness_snapshot: { graph_version: 1, labels: ["agent_eligible", "afk_ready"], reasons: [] },
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
      }
    ],
    document_projections: [],
    execution_slices: []
  },
  edges: [
    { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
    { source: "wi-001", target: "wi-002", type: "depends_on", rationale: "Needs dependency." },
    { source: "wi-002", target: "req-001", type: "satisfies", rationale: "Traceability." }
  ]
});

const workItem = graph.nodes.find((node) => node.kind === "work_item" && String(node.id) === "wi-001");
if (!workItem) {
  throw new Error("Fixture work item missing.");
}

const projection = renderWorkItemProjection(graph, workItem as WorkItemNode);

describe("graph reconciliation", () => {
  it("returns no patch for an unchanged Work Item projection", () => {
    const result = reconcileGraphProjections(graph, [projection]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("proposes a graph patch for a changed Work Item title", () => {
    const result = reconcileGraphProjections(graph, [
      { ...projection, content: projection.content.replace("title: Work item", "title: Renamed work item") }
    ]);

    expect(result.proposedPatches).toMatchObject([
      {
        operation: "replace_work_item_title",
        nodeId: "wi-001",
        field: "title",
        before: "Work item",
        after: "Renamed work item"
      }
    ]);
  });

  it("proposes a graph patch for changed acceptance criteria", () => {
    const result = reconcileGraphProjections(graph, [
      { ...projection, content: projection.content.replace("- First criterion", "- Updated criterion") }
    ]);

    expect(result.proposedPatches).toMatchObject([
      {
        operation: "replace_work_item_acceptance_criteria",
        nodeId: "wi-001",
        after: ["Updated criterion"]
      }
    ]);
  });

  it("returns a conflict for a dependency edit that references a missing Work Item", () => {
    const result = reconcileGraphProjections(graph, [
      { ...projection, content: projection.content.replace("depends_on: [wi-002]", "depends_on: [wi-404]") }
    ]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toMatchObject([
      {
        nodeId: "wi-001",
        field: "depends_on"
      }
    ]);
  });

  it("reports richer unsupported Markdown sections without treating them as conflicts", () => {
    const result = reconcileGraphProjections(graph, [
      {
        ...projection,
        content: projection.content.replace(
          "Use the Planning Graph as the source of truth.",
          "Preserve this human-authored implementation note."
        )
      }
    ]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.unsupportedProjectionEdits).toMatchObject([
      {
        nodeId: "wi-001",
        field: "agent_notes"
      }
    ]);
  });

  it("applies safe patches to a new graph version", () => {
    const [patch] = reconcileGraphProjections(graph, [
      { ...projection, content: projection.content.replace("title: Work item", "title: Renamed work item") }
    ]).proposedPatches;

    const updated = applyGraphPatches(graph, [patch]);
    const updatedWorkItem = updated.nodes.find(isWorkItemOne);

    expect(updated.graphVersion).toBe(2);
    expect(updatedWorkItem?.title).toBe("Renamed work item");
  });
});

function isWorkItemOne(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item" && String(node.id) === "wi-001";
}
