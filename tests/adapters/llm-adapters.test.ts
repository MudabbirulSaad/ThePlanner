import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parsePlanningGraphJson,
  proposeGraphOperationsUseCase
} from "../../src/application/index.js";
import type {
  GraphOperationProposer,
  GraphOperationProposerInput
} from "../../src/application/index.js";
import {
  ClaudeGraphOperationProposer,
  CodexGraphOperationProposer,
  GeminiGraphOperationProposer
} from "../../src/adapters/index.js";
import type { LlmProposalClient, LlmProposalProvider } from "../../src/adapters/index.js";

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

class FixtureProposalClient implements LlmProposalClient {
  public readonly calls: LlmProposalProvider[] = [];

  constructor(private readonly fixturePathByProvider: ReadonlyMap<LlmProposalProvider, string>) {}

  complete(input: { readonly provider: LlmProposalProvider }): string {
    this.calls.push(input.provider);
    const fixturePath = this.fixturePathByProvider.get(input.provider);
    if (!fixturePath) {
      throw new Error(`Missing fixture for provider: ${input.provider}`);
    }

    return readFileSync(resolve(fixturePath), "utf8");
  }
}

describe("LLM graph operation adapters", () => {
  it.each([
    {
      provider: "codex" as const,
      expectedOperation: "AddOpenQuestion",
      expectedNodeId: "oq-001",
      createProposer: (client: LlmProposalClient): GraphOperationProposer =>
        new CodexGraphOperationProposer({ client })
    },
    {
      provider: "claude" as const,
      expectedOperation: "AddRequirement",
      expectedNodeId: "req-001",
      createProposer: (client: LlmProposalClient): GraphOperationProposer =>
        new ClaudeGraphOperationProposer({ client })
    },
    {
      provider: "gemini" as const,
      expectedOperation: "AddDecision",
      expectedNodeId: "dec-001",
      createProposer: (client: LlmProposalClient): GraphOperationProposer =>
        new GeminiGraphOperationProposer({ client })
    }
  ])(
    "$provider returns fixture proposals through the GraphOperationProposer port",
    async ({ provider, expectedOperation, expectedNodeId, createProposer }) => {
      const client = new FixtureProposalClient(
        new Map([[provider, `tests/fixtures/llm/${provider}-proposal-response.json`]])
      );
      const proposer = createProposer(client);

      const result = await proposeGraphOperationsUseCase({
        graphRepository: { load: async () => emptyGraph },
        proposer,
        intakeBrief: {
          sourcePath: "planning/intake/refined-brief.md",
          content: "# Refined Brief\n\nProvider adapter fixture test."
        }
      });

      expect(client.calls).toEqual([provider]);
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
            operation: expectedOperation,
            affectedNodeIds: [expectedNodeId]
          }
        ]
      });
    }
  );

  it("parses fenced provider JSON without mutating canonical graph input", async () => {
    const originalGraphNodes = emptyGraph.nodes;
    const client: LlmProposalClient = {
      complete: (input: GraphOperationProposerInput & { readonly provider: LlmProposalProvider }) => {
        expect(input.graph.nodes).toHaveLength(0);

        return [
          "```json",
          readFileSync(resolve("tests/fixtures/llm/codex-proposal-response.json"), "utf8"),
          "```"
        ].join("\n");
      }
    };

    const result = await proposeGraphOperationsUseCase({
      graphRepository: { load: async () => emptyGraph },
      proposer: new CodexGraphOperationProposer({ client })
    });

    expect(result.status).toBe("candidate");
    expect(emptyGraph.graphVersion).toBe(1);
    expect(emptyGraph.nodes).toBe(originalGraphNodes);
    expect(emptyGraph.nodes).toHaveLength(0);
  });

  it("keeps provider adapters isolated from direct planning writers", () => {
    const adapterSources = [
      "src/adapters/llm/provider-proposers.ts",
      "src/adapters/llm/provider-proposal-parser.ts"
    ].map((path) => readFileSync(resolve(path), "utf8"));

    expect(adapterSources.join("\n")).not.toMatch(
      /GraphRepository|ProjectionWriter|ChangeLogWriter|AgentRunArtifactWriter|writeFile|appendFile|save\(/u
    );
  });
});
