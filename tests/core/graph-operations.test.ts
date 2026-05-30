import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { applyGraphOperationToCandidate } from "../../src/core/index.js";
import type {
  AddDecisionGraphOperation,
  AddOpenQuestionGraphOperation,
  AddRequirementGraphOperation,
  PlanningGraph
} from "../../src/core/index.js";

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

function addRequirementOperation(): AddRequirementGraphOperation {
  return {
    kind: "AddRequirement",
    requirement: {
      id: "req-001" as AddRequirementGraphOperation["requirement"]["id"],
      kind: "requirement",
      title: "Export PRD",
      status: "active",
      requirementType: "functional",
      statement: "The planner must export a deterministic PRD projection.",
      provenance: {
        sourceType: "user_answer",
        sourceReference: "planning/intake/refined-brief.md#requirements",
        createdBy: "test proposer",
        confidence: "high"
      }
    }
  };
}

function addDecisionOperation(status: "accepted" | "proposed" | "revisit" = "proposed"): AddDecisionGraphOperation {
  return {
    kind: "AddDecision",
    decision: {
      id: "dec-001" as AddDecisionGraphOperation["decision"]["id"],
      kind: "decision",
      title: "Use markdown projections",
      status,
      selectedOption: "Use Markdown files as projections over the Planning Graph.",
      rationale: "Projection files are reviewable while the graph remains canonical.",
      rejectedAlternatives: ["Provider-written graph files"],
      unresolvedQuestions: [],
      provenance: {
        sourceType: "user_answer",
        sourceReference: "planning/intake/refined-brief.md#decisions",
        createdBy: "test proposer",
        confidence: "high"
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

  it("applies AddRequirement to a deep-cloned candidate graph", () => {
    const graph = baseGraph();
    const operation = addRequirementOperation();

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    expect(result.approval).toMatchObject({ required: false, category: "none" });
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(result.candidateGraph.nodes[0]).toMatchObject({
      id: "req-001",
      kind: "requirement",
      statement: "The planner must export a deterministic PRD projection."
    });
    expect(graph.nodes).toHaveLength(0);
    expect(result.candidateGraph.nodes[0]).not.toBe(operation.requirement);
  });

  it("rejects malformed Requirement proposals before candidate creation", () => {
    const operation = addRequirementOperation();

    const result = applyGraphOperationToCandidate(baseGraph(), {
      ...operation,
      requirement: {
        ...operation.requirement,
        statement: ""
      }
    });

    expect(result).toEqual({
      status: "rejected",
      errors: [
        {
          code: "requirement_statement_required",
          message: "AddRequirement requires a non-empty statement.",
          nodeId: "req-001"
        }
      ]
    });
  });

  it("applies proposed AddDecision without silently accepting it", () => {
    const graph = baseGraph();
    const operation = addDecisionOperation("proposed");

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    expect(result.approval).toMatchObject({ required: false, category: "none" });
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(result.candidateGraph.nodes[0]).toMatchObject({
      id: "dec-001",
      kind: "decision",
      status: "proposed"
    });
    expect(graph.nodes).toHaveLength(0);
    expect(result.candidateGraph.nodes[0]).not.toBe(operation.decision);
  });

  it("reports accepted Decisions as requiring approval before canonical apply", () => {
    const operation = {
      ...addDecisionOperation("accepted"),
      approvalClassification: {
        category: "commitment_changing" as const,
        rationale: "Accepted decisions change planning commitments."
      }
    };

    const result = applyGraphOperationToCandidate(baseGraph(), operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    expect(result.approval).toEqual({
      required: true,
      category: "commitment_changing",
      rationale: "Accepted decisions change planning commitments."
    });
  });

  it("reports scope-changing proposed Decisions as requiring approval without changing their status", () => {
    const operation = {
      ...addDecisionOperation("proposed"),
      approvalClassification: {
        category: "scope_changing" as const,
        rationale: "This changes the MVP scope."
      }
    };

    const result = applyGraphOperationToCandidate(baseGraph(), operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    expect(result.approval.required).toBe(true);
    expect(result.candidateGraph.nodes[0]).toMatchObject({ id: "dec-001", status: "proposed" });
  });

  it("rejects accepted Decisions without explicit approval classification", () => {
    const result = applyGraphOperationToCandidate(baseGraph(), addDecisionOperation("accepted"));

    expect(result).toEqual({
      status: "rejected",
      errors: [
        {
          code: "decision_approval_classification_required",
          message: "Accepted Decision proposals require an explicit approval classification.",
          nodeId: "dec-001"
        }
      ]
    });
  });
});
