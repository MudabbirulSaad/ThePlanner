import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { renderAllProjections } from "../../src/core/index.js";

describe("projection rendering", () => {
  it("renders deterministic Work Item Markdown from the Planning Graph", () => {
    const graph = parsePlanningGraphJson(
      JSON.parse(readFileSync("examples/ai-engineering-planner-v1/planning/graph.json", "utf8"))
    );
    const rendered = renderAllProjections(graph).find((projection) =>
      projection.path.endsWith("wi-003-implement-graph-validation-and-readiness-derivation.md")
    );

    expect(rendered?.content).toBe(readFileSync("tests/golden/wi-003-projection.md", "utf8"));
  });
});
