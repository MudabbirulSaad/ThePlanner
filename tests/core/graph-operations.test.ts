import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { applyGraphOperationToCandidate } from "../../src/core/index.js";
import type { AddOpenQuestionGraphOperation, PlanningGraph } from "../../src/core/index.js";

function baseGraph(): PlanningGraph {
  return parsePlanningGraphJson({
    schema_version: "0.1.0",
    graph_version: 1,
    nodes: {
      requirements: [],
      decisions: [],
      assumptions: [],
      risks: [],
      open_questions: [],
      hitl_gates: [],
      components: [],
      work_items: [],
      document_projections: [],
      execution_slices: []
    },
    edges: []
  });
}

function addOpenQuestionOperation(): AddOpenQuestionGraphOperation {
  return {
    kind: "AddOpenQuestion",
    openQuestion: {
      id: "oq-001" as AddOpenQuestionGraphOperation["openQuestion"]["id"],
      kind: "open_question",
      title: "Deployment target",
      status: "active",
      question: "Which deployment target should the first release support?",
      priority: "high",
      blocksExecution: true,
      provenance: {
        sourceType: "planner_inference",
        sourceReference: "planning/intake/refined-brief.md#open-questions",
        createdBy: "theplanner graph-operation --dry-run",
        confidence: "medium"
      }
    }
  };
}

describe("graph operations", () => {
  it("applies AddOpenQuestion to a deep-cloned candidate graph", () => {
    const graph = baseGraph();
    const operation = addOpenQuestionOperation();
    const originalNodes = graph.nodes;

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(result.candidateGraph.nodes).toHaveLength(1);
    expect(result.candidateGraph.nodes[0]).toMatchObject({
      id: "oq-001",
      kind: "open_question",
      question: "Which deployment target should the first release support?"
    });
    expect(graph.graphVersion).toBe(1);
    expect(graph.nodes).toBe(originalNodes);
    expect(graph.nodes).toHaveLength(0);
    expect(result.candidateGraph.nodes).not.toBe(graph.nodes);
    expect(result.candidateGraph.edges).not.toBe(graph.edges);
    expect(result.candidateGraph.nodes[0]).not.toBe(operation.openQuestion);
  });

  it("rejects AddOpenQuestion without provenance", () => {
    const operation = addOpenQuestionOperation();
    const result = applyGraphOperationToCandidate(baseGraph(), {
      ...operation,
      openQuestion: {
        ...operation.openQuestion,
        provenance: undefined
      }
    });

    expect(result).toEqual({
      status: "rejected",
      errors: [
        {
          code: "graph_operation_provenance_required",
          message: "Generated or inferred Open Question proposals require provenance.",
          nodeId: "oq-001"
        }
      ]
    });
  });

  it("rejects duplicate Open Question ids before candidate creation", () => {
    const graph = baseGraph();
    const operation = addOpenQuestionOperation();
    const first = applyGraphOperationToCandidate(graph, operation);
    if (first.status !== "applied") {
      throw new Error("expected first operation to apply");
    }

    const second = applyGraphOperationToCandidate(first.candidateGraph, operation);

    expect(second).toEqual({
      status: "rejected",
      errors: [
        {
          code: "graph_operation_duplicate_node_id",
          message: "Planning Graph already contains node id: oq-001",
          nodeId: "oq-001"
        }
      ]
    });
  });
});
