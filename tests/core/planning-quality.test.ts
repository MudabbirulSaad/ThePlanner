import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { assessPlanningQuality } from "../../src/core/index.js";

function loadFixture(path: string) {
  return parsePlanningGraphJson(JSON.parse(readFileSync(path, "utf8")));
}

describe("planning quality", () => {
  it("reports scaffold-heavy Planning Graphs before trusted export", () => {
    const result = assessPlanningQuality(loadFixture("tests/fixtures/planning-quality/scaffold-heavy-graph.json"));

    expect(result.status).toBe("warning");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "planning_quality_product_intent_scaffolded" }),
        expect.objectContaining({ code: "planning_quality_decisions_missing" }),
        expect.objectContaining({ code: "planning_quality_component_generic", nodeId: "comp-001" }),
        expect.objectContaining({ code: "planning_quality_work_item_fallback", nodeId: "wi-001" })
      ])
    );
  });

  it("keeps richer Planning Graphs acceptable", () => {
    const result = assessPlanningQuality(loadFixture("tests/fixtures/planning-quality/rich-graph.json"));

    expect(result).toEqual({
      status: "acceptable",
      findings: []
    });
  });
});
