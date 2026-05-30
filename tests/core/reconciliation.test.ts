import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import {
  applyGraphPatches,
  reconcileGraphProjections,
  renderDocumentProjection,
  renderWorkItemProjection
} from "../../src/core/index.js";
import type { DocumentProjectionNode, PlanningNode, WorkItemNode } from "../../src/core/index.js";

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

const graphWithOpenQuestionProjection = parsePlanningGraphJson({
  schema_version: "0.1.0",
  graph_version: 1,
  nodes: {
    requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
    decisions: [],
    assumptions: [],
    risks: [],
    open_questions: [
      {
        id: "oq-001",
        title: "Which provider should run planning agents",
        status: "active",
        question: "Which provider should run planning agents?",
        priority: "high",
        blocks_execution: true
      }
    ],
    hitl_gates: [],
    components: [],
    work_items: [
      {
        id: "wi-001",
        title: "Work item",
        execution_state: "backlog",
        readiness_snapshot: { graph_version: 1, labels: ["blocked"], reasons: ["Depends on execution-blocking Open Question oq-001."] },
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
      }
    ],
    document_projections: [
      {
        id: "doc-001",
        title: "Product Requirements",
        status: "active",
        path: "docs/prd/product.md",
        projection_type: "prd"
      }
    ],
    execution_slices: []
  },
  edges: [
    { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
    { source: "wi-001", target: "oq-001", type: "depends_on", rationale: "Question blocks execution." }
  ]
});

const prdProjection = renderDocumentProjection(
  graphWithOpenQuestionProjection,
  graphWithOpenQuestionProjection.nodes.find((node) => node.kind === "document_projection") as DocumentProjectionNode
);

describe("graph reconciliation", () => {
  it("returns no patch for an unchanged Work Item projection", () => {
    const result = reconcileGraphProjections(graph, [projection]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("does not treat command-only validation Markdown as an expected result edit", () => {
    const graphWithDescriptiveValidation = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      nodes: {
        requirements: [
          { id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }
        ],
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
            execution_state: "done",
            readiness_snapshot: { graph_version: 1, labels: ["agent_eligible", "afk_ready"], reasons: [] },
            acceptance_criteria: ["Done"],
            validation_methods: [
              { type: "command", command: "npm test", expected_result: "Domain tests pass with fixture data" }
            ]
          }
        ],
        document_projections: [],
        execution_slices: []
      },
      edges: [{ source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." }]
    });
    const workItemWithDescriptiveValidation = graphWithDescriptiveValidation.nodes.find(isWorkItemOne);
    if (!workItemWithDescriptiveValidation) {
      throw new Error("Fixture Work Item missing.");
    }

    const result = reconcileGraphProjections(graphWithDescriptiveValidation, [
      renderWorkItemProjection(graphWithDescriptiveValidation, workItemWithDescriptiveValidation)
    ]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("returns no patch for an unchanged manual-review validation projection", () => {
    const graphWithManualReviewValidation = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      nodes: {
        requirements: [
          { id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }
        ],
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
            readiness_snapshot: { graph_version: 1, labels: ["agent_eligible"], reasons: [] },
            acceptance_criteria: ["Done"],
            validation_methods: [{ type: "manual_review", expected_result: "Reviewer confirms the result." }]
          }
        ],
        document_projections: [],
        execution_slices: []
      },
      edges: [{ source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." }]
    });
    const workItemWithManualReviewValidation = graphWithManualReviewValidation.nodes.find(isWorkItemOne);
    if (!workItemWithManualReviewValidation) {
      throw new Error("Fixture Work Item missing.");
    }

    const result = reconcileGraphProjections(graphWithManualReviewValidation, [
      renderWorkItemProjection(graphWithManualReviewValidation, workItemWithManualReviewValidation)
    ]);

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

  it("proposes safe graph patches for deterministic Open Question edits in a document projection", () => {
    const result = reconcileGraphProjections(graphWithOpenQuestionProjection, [
      {
        ...prdProjection,
        content: prdProjection.content.replace(
          "oq-001 (high priority): Which provider should run planning agents? Blocks execution.",
          "oq-001 (high priority): Which local runner should execute planning agents? Does not block execution."
        )
      }
    ]);

    expect(result.proposedPatches).toMatchObject([
      {
        operation: "replace_open_question_question",
        nodeId: "oq-001",
        field: "question",
        before: "Which provider should run planning agents?",
        after: "Which local runner should execute planning agents?"
      },
      {
        operation: "replace_open_question_blocks_execution",
        nodeId: "oq-001",
        field: "blocks_execution",
        before: true,
        after: false
      }
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("keeps ambiguous document projection edits visible as unsupported edits", () => {
    const result = reconcileGraphProjections(graphWithOpenQuestionProjection, [
      {
        ...prdProjection,
        content: prdProjection.content.replace(
          "oq-001 (high priority): Which provider should run planning agents? Blocks execution.",
          "oq-001: maybe decide later"
        )
      }
    ]);

    expect(result.proposedPatches).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.unsupportedProjectionEdits).toMatchObject([
      {
        nodeId: "oq-001",
        field: "open_questions"
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

  it("applies safe document projection patches to Open Question nodes", () => {
    const patches = reconcileGraphProjections(graphWithOpenQuestionProjection, [
      {
        ...prdProjection,
        content: prdProjection.content.replace(
          "oq-001 (high priority): Which provider should run planning agents? Blocks execution.",
          "oq-001 (high priority): Which local runner should execute planning agents? Does not block execution."
        )
      }
    ]).proposedPatches;

    const updated = applyGraphPatches(graphWithOpenQuestionProjection, patches);
    const updatedQuestion = updated.nodes.find((node) => node.kind === "open_question" && String(node.id) === "oq-001");

    expect(updated.graphVersion).toBe(2);
    expect(updatedQuestion).toMatchObject({
      question: "Which local runner should execute planning agents?",
      blocksExecution: false
    });
  });
});

function isWorkItemOne(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item" && String(node.id) === "wi-001";
}
