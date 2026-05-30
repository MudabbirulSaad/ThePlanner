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
});
