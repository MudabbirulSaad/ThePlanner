import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { applyGraphOperationToCandidate } from "../../src/core/index.js";
import type {
  AddDependencyEdgeGraphOperation,
  AddDecisionGraphOperation,
  AddHitlGateGraphOperation,
  AddWorkItemGraphOperation,
  AddOpenQuestionGraphOperation,
  AddRequirementGraphOperation,
  PlanningGraph,
  UpdateWorkItemExecutionStateGraphOperation
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

function graphWithRequirement(): PlanningGraph {
  return parsePlanningGraphJson({
    schema_version: "0.1.0",
    graph_version: 1,
    nodes: {
      requirements: [
        {
          id: "req-001",
          title: "Dry-run graph operations",
          type: "functional",
          status: "active",
          statement: "The planner must validate graph operation dry-runs before save.",
          provenance: {
            source_type: "user_answer",
            source_reference: "planning/intake/refined-brief.md#requirements",
            created_by: "test",
            confidence: "high"
          }
        }
      ],
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

function graphWithReadyWorkItemsAndQuestion(): PlanningGraph {
  return parsePlanningGraphJson({
    schema_version: "0.1.0",
    graph_version: 1,
    nodes: {
      requirements: [
        {
          id: "req-001",
          title: "Dry-run graph operations",
          type: "functional",
          status: "active",
          statement: "The planner must validate graph operation dry-runs before save.",
          provenance: {
            source_type: "user_answer",
            source_reference: "planning/intake/refined-brief.md#requirements",
            created_by: "test",
            confidence: "high"
          }
        }
      ],
      decisions: [],
      assumptions: [],
      risks: [],
      open_questions: [
        {
          id: "oq-001",
          title: "Release approval",
          question: "Who approves release-blocking implementation choices?",
          priority: "high",
          blocks_execution: true,
          provenance: {
            source_type: "planner_inference",
            source_reference: "planning/intake/refined-brief.md#open-questions",
            created_by: "test",
            confidence: "medium"
          }
        }
      ],
      hitl_gates: [],
      components: [],
      work_items: [
        {
          id: "wi-001",
          title: "Prepare foundation",
          execution_state: "backlog",
          readiness_snapshot: {
            graph_version: 1,
            labels: ["agent_eligible", "afk_ready"],
            reasons: ["Ready before dependency operation."]
          },
          context_summary: "Prepare the reusable foundation.",
          boundary_notes: ["Keep scope limited to foundation work."],
          acceptance_criteria: ["The foundation is implemented."],
          validation_methods: [
            {
              type: "test",
              command: "npm test",
              expected_result: "Tests pass."
            }
          ],
          safe_failure_guidance: "Stop if requirements are unclear.",
          provenance: {
            source_type: "planner_inference",
            source_reference: "issues/034-add-dependency-and-hitl-graph-operations.md",
            created_by: "test",
            confidence: "medium"
          }
        },
        {
          id: "wi-002",
          title: "Build dependent feature",
          execution_state: "backlog",
          readiness_snapshot: {
            graph_version: 1,
            labels: ["agent_eligible", "afk_ready"],
            reasons: ["Ready before dependency operation."]
          },
          context_summary: "Build the feature after graph operation validation.",
          boundary_notes: ["Do not add reviewer automation."],
          acceptance_criteria: ["The feature is implemented."],
          validation_methods: [
            {
              type: "test",
              command: "npm test",
              expected_result: "Tests pass."
            }
          ],
          safe_failure_guidance: "Stop if dependencies are unresolved.",
          provenance: {
            source_type: "planner_inference",
            source_reference: "issues/034-add-dependency-and-hitl-graph-operations.md",
            created_by: "test",
            confidence: "medium"
          }
        }
      ],
      document_projections: [],
      execution_slices: []
    },
    edges: [
      {
        source: "wi-001",
        target: "req-001",
        type: "satisfies",
        rationale: "Foundation work satisfies the graph operation requirement."
      },
      {
        source: "wi-002",
        target: "req-001",
        type: "satisfies",
        rationale: "Dependent feature satisfies the graph operation requirement."
      }
    ]
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

function addDecisionOperation(
  status: "accepted" | "proposed" | "revisit" = "proposed"
): AddDecisionGraphOperation {
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

function addWorkItemOperation(): AddWorkItemGraphOperation {
  return {
    kind: "AddWorkItem",
    workItem: {
      id: "wi-001" as AddWorkItemGraphOperation["workItem"]["id"],
      kind: "work_item",
      title: "Add Work Item operation",
      status: "planned",
      executionState: "backlog",
      readinessSnapshot: {
        graphVersion:
          1 as AddWorkItemGraphOperation["workItem"]["readinessSnapshot"]["graphVersion"],
        labels: ["blocked"],
        reasons: ["Caller-provided readiness must be ignored."]
      },
      contextSummary: "Add a testable graph operation for Work Items.",
      boundaryNotes: ["Do not implement provider prompts."],
      acceptanceCriteria: ["A valid proposal creates a candidate Work Item."],
      validationMethods: [
        {
          type: "test",
          command: "npm test -- tests/core/graph-operations.test.ts",
          expectedResult: "The Work Item graph operation tests pass."
        }
      ],
      safeFailureGuidance:
        "Reject the proposal and report missing fields instead of saving a partial Work Item.",
      provenance: {
        sourceType: "planner_inference",
        sourceReference: "issues/033-add-testable-work-item-graph-operation.md",
        createdBy: "test proposer",
        confidence: "medium"
      }
    },
    edges: [
      {
        source: "wi-001" as AddWorkItemGraphOperation["workItem"]["id"],
        target: "req-001" as AddRequirementGraphOperation["requirement"]["id"],
        type: "satisfies",
        rationale: "The Work Item implements testable graph operation dry-runs."
      }
    ]
  };
}

function addDependencyEdgeOperation(): AddDependencyEdgeGraphOperation {
  return {
    kind: "AddDependencyEdge",
    edge: {
      source: "wi-002" as AddDependencyEdgeGraphOperation["edge"]["source"],
      target: "wi-001" as AddDependencyEdgeGraphOperation["edge"]["target"],
      type: "depends_on",
      rationale: "The dependent feature needs the foundation first."
    }
  };
}

function addHitlGateOperation(): AddHitlGateGraphOperation {
  return {
    kind: "AddHitlGate",
    hitlGate: {
      id: "hitl-001" as AddHitlGateGraphOperation["hitlGate"]["id"],
      kind: "hitl_gate",
      title: "Approve release decision",
      status: "active",
      requiredAction: "Product owner must answer the release approval question.",
      blocks: ["wi-002" as AddHitlGateGraphOperation["hitlGate"]["blocks"][number]],
      provenance: {
        sourceType: "planner_inference",
        sourceReference: "issues/034-add-dependency-and-hitl-graph-operations.md",
        createdBy: "test proposer",
        confidence: "medium"
      }
    },
    edges: [
      {
        source: "hitl-001" as AddHitlGateGraphOperation["hitlGate"]["id"],
        target: "oq-001" as AddOpenQuestionGraphOperation["openQuestion"]["id"],
        type: "references",
        rationale: "Release approval is the uncertainty causing the HITL gate."
      }
    ]
  };
}

function updateWorkItemExecutionStateOperation(): UpdateWorkItemExecutionStateGraphOperation {
  return {
    kind: "UpdateWorkItemExecutionState",
    workItemId: "wi-002" as UpdateWorkItemExecutionStateGraphOperation["workItemId"],
    executionState: "done",
    rationale: "Reviewer validation passed for the agent run.",
    provenance: {
      sourceType: "planner_inference",
      sourceReference: "planning/runs/run-20260529-123456-wi-002/result.json",
      createdBy: "test reviewer proposer",
      confidence: "high"
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

  it("applies AddWorkItem with traceability and derived readiness", () => {
    const graph = graphWithRequirement();
    const operation = addWorkItemOperation();

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    const workItem = result.candidateGraph.nodes.find((node) => String(node.id) === "wi-001");
    expect(workItem).toMatchObject({
      id: "wi-001",
      kind: "work_item",
      readinessSnapshot: {
        graphVersion: 2,
        labels: ["agent_eligible", "afk_ready"],
        reasons: [
          "Context, boundaries, validation, dependency closure, and safe-failure guidance are AFK-ready."
        ]
      }
    });
    expect(result.candidateGraph.edges).toContainEqual({
      source: "wi-001",
      target: "req-001",
      type: "satisfies",
      rationale: "The Work Item implements testable graph operation dry-runs."
    });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(result.candidateGraph.nodes[0]).not.toBe(graph.nodes[0]);
    expect(workItem).not.toBe(operation.workItem);
    expect(result.candidateGraph.edges[0]).not.toBe(operation.edges[0]);
  });

  it.each([
    {
      name: "acceptance criteria",
      operation: () => ({
        ...addWorkItemOperation(),
        workItem: { ...addWorkItemOperation().workItem, acceptanceCriteria: [] }
      }),
      code: "work_item_acceptance_criteria_required"
    },
    {
      name: "executable validation command",
      operation: () => ({
        ...addWorkItemOperation(),
        workItem: {
          ...addWorkItemOperation().workItem,
          validationMethods: [
            { type: "manual_review" as const, expectedResult: "Reviewer checks the change." }
          ]
        }
      }),
      code: "work_item_executable_validation_required"
    },
    {
      name: "context summary",
      operation: () => ({
        ...addWorkItemOperation(),
        workItem: { ...addWorkItemOperation().workItem, contextSummary: "" }
      }),
      code: "work_item_context_summary_required"
    },
    {
      name: "boundary notes",
      operation: () => ({
        ...addWorkItemOperation(),
        workItem: { ...addWorkItemOperation().workItem, boundaryNotes: [] }
      }),
      code: "work_item_boundary_notes_required"
    },
    {
      name: "traceability",
      operation: () => ({
        ...addWorkItemOperation(),
        edges: []
      }),
      code: "work_item_traceability_required"
    },
    {
      name: "safe-failure guidance",
      operation: () => ({
        ...addWorkItemOperation(),
        workItem: { ...addWorkItemOperation().workItem, safeFailureGuidance: "" }
      }),
      code: "work_item_safe_failure_guidance_required"
    }
  ])("rejects AddWorkItem without $name", ({ operation, code }) => {
    const result = applyGraphOperationToCandidate(graphWithRequirement(), operation());

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected operation to be rejected");
    }
    expect(result.errors.map((error) => error.code)).toContain(code);
  });

  it("applies AddDependencyEdge and recomputes affected candidate readiness without mutating canonical graph", () => {
    const graph = graphWithReadyWorkItemsAndQuestion();
    const operation = addDependencyEdgeOperation();
    const originalEdges = graph.edges;
    const originalWorkItem = graph.nodes.find((node) => String(node.id) === "wi-002");

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    const candidateWorkItem = result.candidateGraph.nodes.find(
      (node) => String(node.id) === "wi-002"
    );
    expect(result.approval).toMatchObject({ required: true, category: "readiness_changing" });
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(result.candidateGraph.edges).toContainEqual(operation.edge);
    expect(candidateWorkItem).toMatchObject({
      id: "wi-002",
      readinessSnapshot: {
        graphVersion: 2,
        labels: ["agent_eligible", "blocked"],
        reasons: ["Depends on wi-001, which is backlog."]
      }
    });
    expect(graph.graphVersion).toBe(1);
    expect(graph.edges).toBe(originalEdges);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes.find((node) => String(node.id) === "wi-002")).toBe(originalWorkItem);
    expect(result.candidateGraph.edges.at(-1)).not.toBe(operation.edge);
    expect(candidateWorkItem).not.toBe(originalWorkItem);
  });

  it("rejects AddDependencyEdge when references are missing or self-dependency is proposed", () => {
    const result = applyGraphOperationToCandidate(graphWithReadyWorkItemsAndQuestion(), {
      kind: "AddDependencyEdge",
      edge: {
        source: "wi-002" as AddDependencyEdgeGraphOperation["edge"]["source"],
        target: "wi-002" as AddDependencyEdgeGraphOperation["edge"]["target"],
        type: "depends_on",
        rationale: ""
      }
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected operation to be rejected");
    }
    expect(result.errors.map((error) => error.code)).toEqual([
      "dependency_edge_rationale_required",
      "dependency_edge_self_dependency"
    ]);
  });

  it("rejects AddDependencyEdge before candidate apply when a target reference is missing", () => {
    const result = applyGraphOperationToCandidate(graphWithReadyWorkItemsAndQuestion(), {
      ...addDependencyEdgeOperation(),
      edge: {
        ...addDependencyEdgeOperation().edge,
        target: "wi-999" as AddDependencyEdgeGraphOperation["edge"]["target"]
      }
    });

    expect(result).toEqual({
      status: "rejected",
      errors: [
        {
          code: "dependency_edge_target_missing",
          message: "AddDependencyEdge edge target does not exist: wi-999",
          nodeId: "wi-002"
        }
      ]
    });
  });

  it("applies AddHitlGate and blocks intended Work Item readiness on the candidate graph", () => {
    const graph = graphWithReadyWorkItemsAndQuestion();
    const operation = addHitlGateOperation();
    const originalNodes = graph.nodes;

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    const workItem = result.candidateGraph.nodes.find((node) => String(node.id) === "wi-002");
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(result.candidateGraph.nodes).toContainEqual(operation.hitlGate);
    expect(result.candidateGraph.edges).toContainEqual(operation.edges[0]);
    expect(workItem).toMatchObject({
      id: "wi-002",
      readinessSnapshot: {
        graphVersion: 2,
        labels: ["agent_eligible", "hitl_gated", "blocked"],
        reasons: ["Blocked by unresolved HITL Gate hitl-001."]
      }
    });
    expect(graph.nodes).toBe(originalNodes);
    expect(graph.nodes.some((node) => String(node.id) === "hitl-001")).toBe(false);
    expect(result.candidateGraph.nodes.find((node) => String(node.id) === "hitl-001")).not.toBe(
      operation.hitlGate
    );
    expect(result.candidateGraph.edges.at(-1)).not.toBe(operation.edges[0]);
  });

  it("rejects AddHitlGate without required action, blocked Work Items, or cause links", () => {
    const operation = addHitlGateOperation();
    const result = applyGraphOperationToCandidate(graphWithReadyWorkItemsAndQuestion(), {
      ...operation,
      hitlGate: {
        ...operation.hitlGate,
        requiredAction: "",
        blocks: []
      },
      edges: []
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected operation to be rejected");
    }
    expect(result.errors.map((error) => error.code)).toEqual([
      "hitl_gate_missing_required_action",
      "hitl_gate_missing_blocked_work_items",
      "hitl_gate_missing_cause_link"
    ]);
  });

  it("rejects AddHitlGate when blocked Work Item or cause references are missing", () => {
    const operation = addHitlGateOperation();
    const result = applyGraphOperationToCandidate(graphWithReadyWorkItemsAndQuestion(), {
      ...operation,
      hitlGate: {
        ...operation.hitlGate,
        blocks: ["wi-999" as AddHitlGateGraphOperation["hitlGate"]["blocks"][number]]
      },
      edges: [
        {
          ...operation.edges[0],
          target: "oq-999" as AddHitlGateGraphOperation["edges"][number]["target"]
        }
      ]
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected operation to be rejected");
    }
    expect(result.errors.map((error) => error.code)).toEqual([
      "hitl_gate_blocks_missing_work_item",
      "dependency_edge_target_missing",
      "hitl_gate_missing_cause_link"
    ]);
  });

  it("applies UpdateWorkItemExecutionState to a deep-cloned candidate graph", () => {
    const graph = graphWithReadyWorkItemsAndQuestion();
    const originalWorkItem = graph.nodes.find((node) => String(node.id) === "wi-002");
    const operation = updateWorkItemExecutionStateOperation();

    const result = applyGraphOperationToCandidate(graph, operation);

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      throw new Error("expected operation to apply");
    }
    const candidateWorkItem = result.candidateGraph.nodes.find((node) => String(node.id) === "wi-002");
    expect(result.approval).toMatchObject({ required: true, category: "readiness_changing" });
    expect(result.candidateGraph.graphVersion).toBe(2);
    expect(candidateWorkItem).toMatchObject({
      id: "wi-002",
      executionState: "done",
      readinessSnapshot: {
        graphVersion: 2
      }
    });
    expect(graph.graphVersion).toBe(1);
    expect(graph.nodes.find((node) => String(node.id) === "wi-002")).toBe(originalWorkItem);
    expect(originalWorkItem).toMatchObject({ executionState: "backlog" });
    expect(candidateWorkItem).not.toBe(originalWorkItem);
  });

  it("rejects UpdateWorkItemExecutionState when the target Work Item is missing", () => {
    const result = applyGraphOperationToCandidate(graphWithReadyWorkItemsAndQuestion(), {
      ...updateWorkItemExecutionStateOperation(),
      workItemId: "wi-999" as UpdateWorkItemExecutionStateGraphOperation["workItemId"]
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") {
      throw new Error("expected operation to be rejected");
    }
    expect(result.errors.map((error) => error.code)).toEqual(["work_item_not_found"]);
  });
});
