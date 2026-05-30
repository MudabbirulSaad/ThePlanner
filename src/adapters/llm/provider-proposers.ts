import type {
  GraphOperationProposer,
  GraphOperationProposerInput,
  GraphOperationProposerResult
} from "../../application/index.js";
import { parseLlmGraphOperationProposalResponse } from "./provider-proposal-parser.js";

export type LlmProposalProvider = "codex" | "claude" | "gemini";

export interface LlmProposalClientInput {
  readonly provider: LlmProposalProvider;
  readonly prompt: string;
  readonly graph: GraphOperationProposerInput["graph"];
  readonly intakeBrief?: GraphOperationProposerInput["intakeBrief"];
  readonly userAnswers?: GraphOperationProposerInput["userAnswers"];
}

export interface LlmProposalClient {
  readonly complete: (input: LlmProposalClientInput) => Promise<string> | string;
}

export interface ProviderGraphOperationProposerOptions {
  readonly client: LlmProposalClient;
}

abstract class ProviderGraphOperationProposer implements GraphOperationProposer {
  protected constructor(
    private readonly provider: LlmProposalProvider,
    private readonly options: ProviderGraphOperationProposerOptions
  ) {}

  async propose(input: GraphOperationProposerInput): Promise<GraphOperationProposerResult> {
    const response = await this.options.client.complete({
      provider: this.provider,
      prompt: renderProposalPrompt(this.provider, input),
      graph: input.graph,
      ...(input.intakeBrief ? { intakeBrief: input.intakeBrief } : {}),
      ...(input.userAnswers ? { userAnswers: input.userAnswers } : {})
    });

    return parseLlmGraphOperationProposalResponse(response, `${this.provider} proposal response`);
  }
}

export class CodexGraphOperationProposer extends ProviderGraphOperationProposer {
  constructor(options: ProviderGraphOperationProposerOptions) {
    super("codex", options);
  }
}

export class ClaudeGraphOperationProposer extends ProviderGraphOperationProposer {
  constructor(options: ProviderGraphOperationProposerOptions) {
    super("claude", options);
  }
}

export class GeminiGraphOperationProposer extends ProviderGraphOperationProposer {
  constructor(options: ProviderGraphOperationProposerOptions) {
    super("gemini", options);
  }
}

function renderProposalPrompt(provider: LlmProposalProvider, input: GraphOperationProposerInput): string {
  const briefLine = input.intakeBrief
    ? `Intake Brief: ${input.intakeBrief.sourcePath}`
    : "Intake Brief: none";
  const answerCount = input.userAnswers?.length ?? 0;

  return [
    `Provider: ${provider}`,
    "Return deterministic Proposed Graph Operation JSON only.",
    `Graph Version: ${input.graph.graphVersion}`,
    briefLine,
    `User Answers: ${answerCount}`
  ].join("\n");
}
