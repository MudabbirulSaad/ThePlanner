import { describe, expect, it } from "vitest";

import {
  graphOperationDryRunUseCase,
  parsePlanningGraphJson
} from "../../src/application/index.js";
import type { GraphRepository } from "../../src/application/index.js";

const graph = parsePlanningGraphJson({
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

const validProposal = {
  operation: "add_open_question",
  open_question: {
    id: "oq-001",
    title: "Deployment target",
    question: "Which deployment target should the first release support?",
    priority: "high",
    blocks_execution: true,
    provenance: {
      source_type: "planner_inference",
      source_reference: "planning/intake/refined-brief.md#open-questions",
      created_by: "test proposer",
      confidence: "medium"
    }
  }
};

const graphWithRequirement = parsePlanningGraphJson({
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

const graphWithReadyWorkItemsAndQuestion = parsePlanningGraphJson({
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

const validWorkItemProposal = {
  operation: "add_work_item",
  work_item: {
    id: "wi-001",
    title: "Add Work Item operation",
    execution_state: "backlog",
    context_summary: "Add a testable graph operation for Work Items.",
    boundary_notes: ["Do not implement provider prompts."],
    acceptance_criteria: ["A valid proposal creates a candidate Work Item."],
    validation_methods: [
      {
        type: "test",
        command: "npm test -- tests/core/graph-operations.test.ts",
        expected_result: "The Work Item graph operation tests pass."
      }
    ],
    safe_failure_guidance:
      "Reject the proposal and report missing fields instead of saving a partial Work Item.",
    provenance: {
      source_type: "planner_inference",
      source_reference: "issues/033-add-testable-work-item-graph-operation.md",
      created_by: "test proposer",
      confidence: "medium"
    }
  },
  edges: [
    {
      source: "wi-001",
      target: "req-001",
      type: "satisfies",
      rationale: "The Work Item implements testable graph operation dry-runs."
    }
  ]
};

const validDependencyEdgeProposal = {
  operation: "add_dependency_edge",
  edge: {
    source: "wi-002",
    target: "wi-001",
    type: "depends_on",
    rationale: "The dependent feature needs the foundation first."
  }
};

const validHitlGateProposal = {
  operation: "add_hitl_gate",
  hitl_gate: {
    id: "hitl-001",
    title: "Approve release decision",
    status: "active",
    required_action: "Product owner must answer the release approval question.",
    blocks: ["wi-002"],
    provenance: {
      source_type: "planner_inference",
      source_reference: "issues/034-add-dependency-and-hitl-graph-operations.md",
      created_by: "test proposer",
      confidence: "medium"
    }
  },
  edges: [
    {
      source: "hitl-001",
      target: "oq-001",
      type: "references",
      rationale: "Release approval is the uncertainty causing the HITL gate."
    }
  ]
};

describe("graph operation dry-run use case", () => {
  it("returns a validated candidate graph without saving or mutating canonical graph", async () => {
    let saveCalled = false;
    const originalNodes = graph.nodes;
    const repository: GraphRepository = {
      load: async () => graph,
      save: async () => {
        saveCalled = true;
      }
    };

    const result = await graphOperationDryRunUseCase({
      graphRepository: repository,
      proposalReader: { readJson: async () => validProposal },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      dryRun: true,
      applied: false,
      sourcePath: "proposal.json",
      operation: "AddOpenQuestion",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      approvalRequired: false,
      approvalCategory: "none",
      operationErrors: [],
      validation: { status: "pass" }
    });
    expect(result.candidateGraph).toMatchObject({
      graph_version: 2,
      nodes: {
        open_questions: [
          {
            id: "oq-001",
            title: "Deployment target",
            question: "Which deployment target should the first release support?",
            priority: "high",
            blocks_execution: true
          }
        ]
      }
    });
    expect(saveCalled).toBe(false);
    expect(graph.graphVersion).toBe(1);
    expect(graph.nodes).toBe(originalNodes);
    expect(graph.nodes).toHaveLength(0);
  });

  it("rejects invalid AddOpenQuestion proposals with useful validation output", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graph },
      proposalReader: {
        readJson: async () => ({
          ...validProposal,
          open_question: {
            ...validProposal.open_question,
            provenance: undefined
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "rejected",
      dryRun: true,
      applied: false,
      graphVersionBefore: 1,
      graphVersionAfter: 1,
      approvalRequired: false,
      approvalCategory: "none",
      operationErrors: [
        {
          code: "graph_operation_provenance_required",
          message: "Generated or inferred Open Question proposals require provenance.",
          nodeId: "oq-001"
        }
      ],
      validation: { status: "pass" }
    });
    expect(result.candidateGraph).toBeUndefined();
  });

  it("dry-runs valid Requirement proposals", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graph },
      proposalReader: {
        readJson: async () => ({
          operation: "add_requirement",
          requirement: {
            id: "req-001",
            title: "Export PRD",
            type: "functional",
            statement: "The planner must export a deterministic PRD projection.",
            status: "active",
            provenance: {
              source_type: "user_answer",
              source_reference: "planning/intake/refined-brief.md#requirements",
              created_by: "test proposer",
              confidence: "high"
            }
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddRequirement",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      approvalRequired: false,
      validation: { status: "pass" },
      candidateGraph: {
        nodes: {
          requirements: [
            {
              id: "req-001",
              title: "Export PRD",
              type: "functional",
              statement: "The planner must export a deterministic PRD projection."
            }
          ]
        }
      }
    });
  });

  it("dry-runs proposed Decision proposals without accepting them", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graph },
      proposalReader: {
        readJson: async () => ({
          operation: "add_decision",
          decision: {
            id: "dec-001",
            title: "Use markdown projections",
            status: "proposed",
            selected_option: "Use Markdown files as projections over the Planning Graph.",
            rationale: "Projection files are reviewable while the graph remains canonical.",
            rejected_alternatives: ["Provider-written graph files"],
            unresolved_questions: [],
            provenance: {
              source_type: "user_answer",
              source_reference: "planning/intake/refined-brief.md#decisions",
              created_by: "test proposer",
              confidence: "high"
            }
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddDecision",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      approvalRequired: false,
      validation: { status: "pass" },
      candidateGraph: {
        nodes: {
          decisions: [
            {
              id: "dec-001",
              status: "proposed",
              selected_option: "Use Markdown files as projections over the Planning Graph."
            }
          ]
        }
      }
    });
  });

  it("reports accepted Decision proposals as approval-required", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graph },
      proposalReader: {
        readJson: async () => ({
          operation: "add_decision",
          approval_classification: {
            category: "commitment_changing",
            rationale: "Accepted decisions change planning commitments."
          },
          decision: {
            id: "dec-001",
            title: "Use markdown projections",
            status: "accepted",
            selected_option: "Use Markdown files as projections over the Planning Graph.",
            rationale: "Projection files are reviewable while the graph remains canonical.",
            rejected_alternatives: ["Provider-written graph files"],
            unresolved_questions: [],
            provenance: {
              source_type: "user_answer",
              source_reference: "planning/intake/refined-brief.md#decisions",
              created_by: "test proposer",
              confidence: "high"
            }
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddDecision",
      approvalRequired: true,
      approvalCategory: "commitment_changing",
      approvalRationale: "Accepted decisions change planning commitments.",
      validation: { status: "pass" }
    });
  });

  it("rejects malformed Decision proposals before save", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graph },
      proposalReader: {
        readJson: async () => ({
          operation: "add_decision",
          decision: {
            id: "dec-001",
            title: "Use markdown projections",
            status: "accepted",
            selected_option: "Use Markdown files as projections over the Planning Graph.",
            rationale: "Projection files are reviewable while the graph remains canonical.",
            rejected_alternatives: ["Provider-written graph files"],
            unresolved_questions: [],
            provenance: {
              source_type: "user_answer",
              source_reference: "planning/intake/refined-brief.md#decisions",
              created_by: "test proposer",
              confidence: "high"
            }
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "rejected",
      operationErrors: [
        {
          code: "decision_approval_classification_required",
          message: "Accepted Decision proposals require an explicit approval classification.",
          nodeId: "dec-001"
        }
      ]
    });
    expect(result.candidateGraph).toBeUndefined();
  });

  it("dry-runs valid Work Item proposals with derived readiness and traceability", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graphWithRequirement },
      proposalReader: { readJson: async () => validWorkItemProposal },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddWorkItem",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      validation: { status: "pass" },
      candidateGraph: {
        nodes: {
          work_items: [
            {
              id: "wi-001",
              readiness_snapshot: {
                graph_version: 2,
                labels: ["agent_eligible", "afk_ready"]
              },
              context_summary: "Add a testable graph operation for Work Items.",
              boundary_notes: ["Do not implement provider prompts."],
              acceptance_criteria: ["A valid proposal creates a candidate Work Item."],
              safe_failure_guidance:
                "Reject the proposal and report missing fields instead of saving a partial Work Item."
            }
          ]
        },
        edges: [
          {
            source: "wi-001",
            target: "req-001",
            type: "satisfies",
            rationale: "The Work Item implements testable graph operation dry-runs."
          }
        ]
      }
    });
  });

  it("rejects invalid Work Item proposals before save", async () => {
    let saveCalled = false;
    const result = await graphOperationDryRunUseCase({
      graphRepository: {
        load: async () => graphWithRequirement,
        save: async () => {
          saveCalled = true;
        }
      },
      proposalReader: {
        readJson: async () => ({
          ...validWorkItemProposal,
          work_item: {
            ...validWorkItemProposal.work_item,
            validation_methods: [
              {
                type: "manual_review",
                expected_result: "Reviewer checks the change."
              }
            ]
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "rejected",
      operation: "AddWorkItem",
      operationErrors: [
        {
          code: "work_item_executable_validation_required",
          message:
            "LLM-origin AddWorkItem proposals require a command or test validation method with an explicit command.",
          nodeId: "wi-001"
        }
      ]
    });
    expect(result.candidateGraph).toBeUndefined();
    expect(saveCalled).toBe(false);
    expect(graphWithRequirement.nodes).toHaveLength(1);
    expect(graphWithRequirement.edges).toHaveLength(0);
  });

  it("dry-runs valid Dependency Edge proposals with derived readiness", async () => {
    let saveCalled = false;
    const originalEdges = graphWithReadyWorkItemsAndQuestion.edges;
    const result = await graphOperationDryRunUseCase({
      graphRepository: {
        load: async () => graphWithReadyWorkItemsAndQuestion,
        save: async () => {
          saveCalled = true;
        }
      },
      proposalReader: { readJson: async () => validDependencyEdgeProposal },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddDependencyEdge",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      approvalRequired: true,
      approvalCategory: "readiness_changing",
      validation: { status: "pass" },
      candidateGraph: {
        nodes: {
          work_items: [
            {},
            {
              id: "wi-002",
              readiness_snapshot: {
                graph_version: 2,
                labels: ["agent_eligible", "blocked"],
                reasons: ["Depends on wi-001, which is backlog."]
              }
            }
          ]
        },
        edges: [
          {},
          {},
          {
            source: "wi-002",
            target: "wi-001",
            type: "depends_on",
            rationale: "The dependent feature needs the foundation first."
          }
        ]
      }
    });
    expect(saveCalled).toBe(false);
    expect(graphWithReadyWorkItemsAndQuestion.edges).toBe(originalEdges);
    expect(graphWithReadyWorkItemsAndQuestion.edges).toHaveLength(2);
  });

  it("rejects invalid Dependency Edge proposals before save", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graphWithReadyWorkItemsAndQuestion },
      proposalReader: {
        readJson: async () => ({
          ...validDependencyEdgeProposal,
          edge: {
            ...validDependencyEdgeProposal.edge,
            target: "wi-999"
          }
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "rejected",
      operation: "AddDependencyEdge",
      graphVersionBefore: 1,
      graphVersionAfter: 1,
      operationErrors: [
        {
          code: "dependency_edge_target_missing",
          message: "AddDependencyEdge edge target does not exist: wi-999",
          nodeId: "wi-002"
        }
      ]
    });
    expect(result.candidateGraph).toBeUndefined();
  });

  it("dry-runs valid HITL Gate proposals with derived readiness", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graphWithReadyWorkItemsAndQuestion },
      proposalReader: { readJson: async () => validHitlGateProposal },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      operation: "AddHitlGate",
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      approvalRequired: true,
      approvalCategory: "readiness_changing",
      validation: { status: "pass" },
      candidateGraph: {
        nodes: {
          hitl_gates: [
            {
              id: "hitl-001",
              title: "Approve release decision",
              required_action: "Product owner must answer the release approval question.",
              blocks: ["wi-002"]
            }
          ],
          work_items: [
            {},
            {
              id: "wi-002",
              readiness_snapshot: {
                graph_version: 2,
                labels: ["agent_eligible", "hitl_gated", "blocked"],
                reasons: ["Blocked by unresolved HITL Gate hitl-001."]
              }
            }
          ]
        },
        edges: [
          {},
          {},
          {
            source: "hitl-001",
            target: "oq-001",
            type: "references",
            rationale: "Release approval is the uncertainty causing the HITL gate."
          }
        ]
      }
    });
    expect(
      graphWithReadyWorkItemsAndQuestion.nodes.some((node) => String(node.id) === "hitl-001")
    ).toBe(false);
  });

  it("rejects invalid HITL Gate proposals before save", async () => {
    const result = await graphOperationDryRunUseCase({
      graphRepository: { load: async () => graphWithReadyWorkItemsAndQuestion },
      proposalReader: {
        readJson: async () => ({
          ...validHitlGateProposal,
          hitl_gate: {
            ...validHitlGateProposal.hitl_gate,
            required_action: "",
            blocks: []
          },
          edges: []
        })
      },
      fromPath: "proposal.json"
    });

    expect(result).toMatchObject({
      status: "rejected",
      operation: "AddHitlGate",
      operationErrors: [
        { code: "hitl_gate_missing_required_action", nodeId: "hitl-001" },
        { code: "hitl_gate_missing_blocked_work_items", nodeId: "hitl-001" },
        { code: "hitl_gate_missing_cause_link", nodeId: "hitl-001" }
      ]
    });
    expect(result.candidateGraph).toBeUndefined();
  });
});
