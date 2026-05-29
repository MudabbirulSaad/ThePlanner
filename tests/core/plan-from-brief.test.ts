import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { proposePlanningGraphFromBrief, validatePlanningGraph } from "../../src/core/index.js";

describe("plan from refined brief proposal", () => {
  it("creates a deterministic valid graph proposal from a refined brief", () => {
    const content = readFileSync("tests/fixtures/intake/refined-brief.md", "utf8");
    const first = proposePlanningGraphFromBrief({
      sourcePath: "tests/fixtures/intake/refined-brief.md",
      content
    });
    const second = proposePlanningGraphFromBrief({
      sourcePath: "tests/fixtures/intake/refined-brief.md",
      content
    });

    expect(second).toEqual(first);
    expect(validatePlanningGraph(first.graph).status).toBe("pass");
    expect(first.graph.nodes.filter((node) => node.kind === "requirement").map((node) => node.id)).toEqual([
      "req-001",
      "req-002",
      "req-003"
    ]);
    expect(first.graph.nodes.filter((node) => node.kind === "open_question")).toHaveLength(2);
    expect(first.graph.nodes.filter((node) => node.kind === "risk")).toHaveLength(1);
    expect(first.graph.nodes.filter((node) => node.kind === "component").map((node) => node.id)).toEqual([
      "comp-001",
      "comp-002",
      "comp-003"
    ]);
    expect(first.graph.nodes.filter((node) => node.kind === "work_item")).toHaveLength(3);
    expect(first.graph.nodes.filter((node) => node.kind === "document_projection").map((node) => node.id)).toEqual([
      "doc-001",
      "doc-002",
      "doc-003"
    ]);
    expect(first.graph.nodes.filter((node) => node.kind === "execution_slice")).toHaveLength(1);
  });

  it("rejects an empty refined brief", () => {
    expect(() =>
      proposePlanningGraphFromBrief({
        sourcePath: "planning/intake/refined-brief.md",
        content: " \n"
      })
    ).toThrow("Refined brief is empty: planning/intake/refined-brief.md");
  });
});
