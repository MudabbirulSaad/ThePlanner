import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseProposedGraphOperationJson } from "../../src/application/index.js";

const examplesDirectory = "examples/proposed-graph-operations";

const validExamples = [
  ["add-open-question.json", "AddOpenQuestion"],
  ["add-requirement.json", "AddRequirement"],
  ["add-decision.json", "AddDecision"],
  ["add-work-item.json", "AddWorkItem"],
  ["add-dependency-edge.json", "AddDependencyEdge"],
  ["add-hitl-gate.json", "AddHitlGate"],
  ["update-work-item-execution-state.json", "UpdateWorkItemExecutionState"]
] as const;

const malformedExamples = [
  ["malformed-missing-operation.json", "operation"],
  ["malformed-work-item-bad-validation-method.json", "validation_methods.0.type"]
] as const;

describe("Proposed Graph Operation schema", () => {
  it.each(validExamples)("validates example proposal file %s", (filename, operationKind) => {
    const parsed = parseProposedGraphOperationJson(readJsonExample(filename));

    expect(parsed.kind).toBe(operationKind);
  });

  it.each(malformedExamples)("rejects malformed example proposal file %s", (filename, expectedPath) => {
    expect(() => parseProposedGraphOperationJson(readJsonExample(filename))).toThrow(expectedPath);
  });

  it("rejects unknown fields before candidate graph application", () => {
    expect(() =>
      parseProposedGraphOperationJson({
        operation: "add_dependency_edge",
        edge: {
          source: "wi-102",
          target: "wi-101",
          type: "depends_on",
          rationale: "The follow-up Work Item depends on the schema documentation Work Item.",
          invented_field: true
        }
      })
    ).toThrow("Unrecognized key");
  });
});

function readJsonExample(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(examplesDirectory, filename), "utf8"));
}
