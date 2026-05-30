import type {
  GraphOperationProposerProposal,
  GraphOperationProposerResult
} from "../../application/index.js";

export function parseLlmGraphOperationProposalResponse(
  response: string,
  responseLabel: string
): GraphOperationProposerResult {
  const parsed = parseResponseJson(response, responseLabel);
  const proposalsValue = readArray(parsed.proposals, `${responseLabel}.proposals`);

  return {
    proposals: proposalsValue.map((proposalValue, index) =>
      readProposal(proposalValue, `${responseLabel}.proposals[${index}]`)
    )
  };
}

function parseResponseJson(response: string, responseLabel: string): Record<string, unknown> {
  try {
    return readObject(JSON.parse(stripJsonFence(response)), responseLabel);
  } catch (error) {
    throw new Error(
      `Invalid ${responseLabel}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function stripJsonFence(response: string): string {
  const trimmed = response.trim();
  const fenced = /^```(?:json)?\s*(?<json>[\s\S]*?)\s*```$/u.exec(trimmed);
  return fenced?.groups?.json ?? trimmed;
}

function readProposal(value: unknown, path: string): GraphOperationProposerProposal {
  const proposal = readObject(value, path);
  const sourceReference = readOptionalString(
    proposal.source_reference ?? proposal.sourceReference,
    `${path}.source_reference`
  );
  const rationale = readOptionalString(proposal.rationale, `${path}.rationale`);

  return {
    operation: readObject(proposal.operation, `${path}.operation`),
    ...(sourceReference ? { sourceReference } : {}),
    ...(rationale ? { rationale } : {})
  };
}

function readObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}
