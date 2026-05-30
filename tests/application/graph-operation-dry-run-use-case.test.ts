import { describe, expect, it } from "vitest";

import { graphOperationDryRunUseCase, parsePlanningGraphJson } from "../../src/application/index.js";
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
    safe_failure_guidance: "Reject the proposal and report missing fields instead of saving a partial Work Item.",
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
              safe_failure_guidance: "Reject the proposal and report missing fields instead of saving a partial Work Item."
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
          message: "LLM-origin AddWorkItem proposals require a command or test validation method with an explicit command.",
          nodeId: "wi-001"
        }
      ]
    });
    expect(result.candidateGraph).toBeUndefined();
    expect(saveCalled).toBe(false);
    expect(graphWithRequirement.nodes).toHaveLength(1);
    expect(graphWithRequirement.edges).toHaveLength(0);
  });
});
