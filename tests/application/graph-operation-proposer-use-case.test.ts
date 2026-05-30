import { describe, expect, it } from "vitest";

import {
  grillingSessionDryRunUseCase,
  parsePlanningGraphJson,
  proposeGraphOperationsUseCase
} from "../../src/application/index.js";
import type {
  GraphOperationProposer,
  GraphOperationProposerInput,
  GraphOperationProposerResult,
  GraphRepository
} from "../../src/application/index.js";

const emptyGraph = parsePlanningGraphJson({
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

class DeterministicFakeProposer implements GraphOperationProposer {
  constructor(private readonly proposeResult: (input: GraphOperationProposerInput) => GraphOperationProposerResult) {}

  propose(input: GraphOperationProposerInput): GraphOperationProposerResult {
    return this.proposeResult(input);
  }
}

describe("graph operation proposer use case", () => {
  it("runs a grilling dry-run from an Intake Brief and returns proposed Open Questions", async () => {
    let saveCalled = false;
    const proposer = new DeterministicFakeProposer((input) => {
      expect(input.intakeBrief).toMatchObject({
        sourcePath: "planning/intake/refined-brief.md",
        content: "# Intake Brief\n\nTarget users are unclear."
      });

      return {
        proposals: [
          {
            sourceReference: "planning/intake/refined-brief.md#target-users",
            operation: {
              operation: "add_open_question",
              open_question: {
                id: "oq-001",
                title: "Target users",
                question: "Which user role should the first release optimize for?",
                priority: "high",
                blocks_execution: true,
                provenance: {
                  source_type: "planner_inference",
                  source_reference: "planning/intake/refined-brief.md#target-users",
                  created_by: "deterministic fake proposer",
                  confidence: "medium"
                }
              }
            }
          }
        ]
      };
    });

    const result = await grillingSessionDryRunUseCase({
      graphRepository: {
        load: async () => emptyGraph,
        save: async () => {
          saveCalled = true;
        }
      },
      refinedBriefReader: {
        read: async () => "# Intake Brief\n\nTarget users are unclear."
      },
      proposer,
      fromPath: "planning/intake/refined-brief.md"
    });

    expect(result).toMatchObject({
      status: "candidate",
      dryRun: true,
      applied: false,
      sourcePath: "planning/intake/refined-brief.md",
      proposalCount: 1,
      proposedOpenQuestions: [
        {
          id: "oq-001",
          title: "Target users",
          question: "Which user role should the first release optimize for?",
          priority: "high",
          blocksExecution: true
        }
      ],
      validation: { status: "pass" }
    });
    expect(saveCalled).toBe(false);
  });

  it("feeds answer files into grilling follow-up proposals and marks accepted Decisions approval-required", async () => {
    const proposer = new DeterministicFakeProposer((input) => {
      expect(input.userAnswers).toEqual([
        {
          questionId: "oq-001",
          question: "Which user role should the first release optimize for?",
          answer: "Maintainers preparing AFK-ready Work Items.",
          sourceReference: "planning/intake/answers.json#answer-1"
        }
      ]);

      return {
        proposals: [
          {
            sourceReference: input.userAnswers?.[0]?.sourceReference,
            operation: {
              operation: "add_decision",
              decision: {
                id: "dec-001",
                title: "Primary user",
                status: "accepted",
                selected_option: "Maintainers preparing AFK-ready Work Items",
                rationale: "The user answer explicitly names maintainers as the first-release audience.",
                rejected_alternatives: ["General project managers"],
                unresolved_questions: [],
                provenance: {
                  source_type: "user_answer",
                  source_reference: input.userAnswers?.[0]?.sourceReference,
                  created_by: "deterministic fake proposer",
                  confidence: "high"
                }
              },
              approval_classification: {
                category: "commitment_changing",
                rationale: "Accepted decisions from grilling answers change planning commitments."
              }
            }
          }
        ]
      };
    });

    const result = await grillingSessionDryRunUseCase({
      graphRepository: { load: async () => emptyGraph },
      refinedBriefReader: { read: async () => "# Intake Brief" },
      userAnswerReader: {
        readJson: async () => ({
          answers: [
            {
              question_id: "oq-001",
              question: "Which user role should the first release optimize for?",
              answer: "Maintainers preparing AFK-ready Work Items."
            }
          ]
        })
      },
      proposer,
      fromPath: "planning/intake/refined-brief.md",
      answersPath: "planning/intake/answers.json"
    });

    expect(result).toMatchObject({
      status: "candidate",
      answersPath: "planning/intake/answers.json",
      proposedOperations: [
        {
          sourcePath: "planning/intake/answers.json#answer-1",
          operation: "AddDecision",
          approvalRequired: true,
          approvalCategory: "commitment_changing",
          affectedNodeIds: ["dec-001"]
        }
      ],
      results: [
        {
          operation: "AddDecision",
          approvalRequired: true,
          approvalCategory: "commitment_changing"
        }
      ],
      validation: { status: "pass" }
    });
  });

  it("requests fake proposer output from user-answer input and validates candidate operations", async () => {
    const proposer = new DeterministicFakeProposer((input) => {
      const answer = input.userAnswers?.[0]?.answer ?? "Unknown deployment target";

      return {
        proposals: [
          {
            sourceReference: input.userAnswers?.[0]?.sourceReference,
            operation: {
              operation: "add_open_question",
              open_question: {
                id: "oq-001",
                title: "Deployment target",
                question: `Confirm deployment target: ${answer}`,
                priority: "high",
                blocks_execution: true,
                provenance: {
                  source_type: "user_answer",
                  source_reference: input.userAnswers?.[0]?.sourceReference,
                  created_by: "deterministic fake proposer",
                  confidence: "medium"
                }
              }
            }
          }
        ]
      };
    });

    const result = await proposeGraphOperationsUseCase({
      graphRepository: { load: async () => emptyGraph },
      proposer,
      userAnswers: [
        {
          questionId: "target-platform",
          question: "Where should this deploy?",
          answer: "GitHub Actions and npm",
          sourceReference: "planning/intake/answers.md#target-platform"
        }
      ]
    });

    expect(result).toMatchObject({
      status: "candidate",
      dryRun: true,
      applied: false,
      proposalCount: 1,
      graphVersionBefore: 1,
      graphVersionAfter: 2,
      validation: { status: "pass" },
      results: [
        {
          status: "candidate",
          sourcePath: "planning/intake/answers.md#target-platform",
          operation: "AddOpenQuestion",
          graphVersionBefore: 1,
          graphVersionAfter: 2,
          operationErrors: []
        }
      ],
      candidateGraph: {
        nodes: {
          open_questions: [
            {
              id: "oq-001",
              question: "Confirm deployment target: GitHub Actions and npm"
            }
          ]
        }
      }
    });
  });

  it("validates sequential fake proposals through the graph operation pipeline", async () => {
    const proposer = new DeterministicFakeProposer(() => ({
      proposals: [
        {
          operation: {
            operation: "add_requirement",
            requirement: {
              id: "req-001",
              title: "Proposal validation",
              type: "functional",
              status: "active",
              statement: "The planner must validate proposed operations before saving them.",
              provenance: {
                source_type: "planner_inference",
                source_reference: "planning/intake/refined-brief.md#requirements",
                created_by: "deterministic fake proposer",
                confidence: "medium"
              }
            }
          }
        },
        {
          operation: {
            operation: "add_work_item",
            work_item: {
              id: "wi-001",
              title: "Add proposer validation tests",
              execution_state: "backlog",
              context_summary: "Cover the GraphOperationProposer use case.",
              boundary_notes: ["Keep provider adapters out of scope."],
              acceptance_criteria: ["Invalid proposals are rejected before save."],
              validation_methods: [
                {
                  type: "test",
                  command: "npm test -- tests/application/graph-operation-proposer-use-case.test.ts",
                  expected_result: "The proposer use case tests pass."
                }
              ],
              safe_failure_guidance: "Reject invalid graph operations instead of saving.",
              provenance: {
                source_type: "planner_inference",
                source_reference: "issues/036-add-graph-operation-proposer-port.md",
                created_by: "deterministic fake proposer",
                confidence: "medium"
              }
            },
            edges: [
              {
                source: "wi-001",
                target: "req-001",
                type: "satisfies",
                rationale: "The Work Item satisfies the generated requirement."
              }
            ]
          }
        }
      ]
    }));

    const result = await proposeGraphOperationsUseCase({
      graphRepository: { load: async () => emptyGraph },
      proposer,
      intakeBrief: {
        sourcePath: "planning/intake/refined-brief.md",
        content: "# Refined Brief"
      }
    });

    expect(result).toMatchObject({
      status: "candidate",
      proposalCount: 2,
      graphVersionBefore: 1,
      graphVersionAfter: 3,
      validation: { status: "pass" },
      results: [
        {
          status: "candidate",
          operation: "AddRequirement",
          graphVersionBefore: 1,
          graphVersionAfter: 2
        },
        {
          status: "candidate",
          operation: "AddWorkItem",
          graphVersionBefore: 2,
          graphVersionAfter: 3
        }
      ],
      candidateGraph: {
        nodes: {
          requirements: [{ id: "req-001" }],
          work_items: [
            {
              id: "wi-001",
              readiness_snapshot: {
                graph_version: 3,
                labels: ["agent_eligible", "afk_ready"]
              }
            }
          ]
        },
        edges: [
          {
            source: "wi-001",
            target: "req-001",
            type: "satisfies"
          }
        ]
      }
    });
  });

  it("rejects invalid fake proposer output before save and does not mutate canonical graph", async () => {
    let saveCalled = false;
    const originalNodes = emptyGraph.nodes;
    const proposer = new DeterministicFakeProposer((input) => {
      (input.graph.nodes as unknown[]).push({
        id: "req-999",
        kind: "requirement",
        title: "Mutated inside proposer"
      });

      return {
        proposals: [
          {
            operation: {
              operation: "add_open_question",
              open_question: {
                id: "oq-001",
                title: "Deployment target",
                question: "Which deployment target should the first release support?",
                priority: "high",
                blocks_execution: true
              }
            }
          }
        ]
      };
    });
    const repository: GraphRepository = {
      load: async () => emptyGraph,
      save: async () => {
        saveCalled = true;
      }
    };

    const result = await proposeGraphOperationsUseCase({
      graphRepository: repository,
      proposer
    });

    expect(result).toMatchObject({
      status: "rejected",
      dryRun: true,
      applied: false,
      proposalCount: 1,
      graphVersionBefore: 1,
      graphVersionAfter: 1,
      results: [
        {
          status: "rejected",
          operation: "AddOpenQuestion",
          operationErrors: [
            {
              code: "graph_operation_provenance_required",
              nodeId: "oq-001"
            }
          ]
        }
      ]
    });
    expect(saveCalled).toBe(false);
    expect(emptyGraph.graphVersion).toBe(1);
    expect(emptyGraph.nodes).toBe(originalNodes);
    expect(emptyGraph.nodes).toHaveLength(0);
  });
});
