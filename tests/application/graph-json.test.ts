import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson, serializePlanningGraphJson } from "../../src/application/index.js";

describe("planning graph JSON mapping", () => {
  it("round-trips PRD-grade product intent fields", () => {
    const graph = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      source: "planning/intake/refined-brief.md",
      product_intent: {
        summary: "Build a repository-native planning CLI.",
        target_users: ["Solo maintainers"],
        goals: ["Generate reviewable planning graphs"],
        mvp_scope: ["Plan from a refined brief"],
        non_goals: ["Live tracker sync"],
        constraints: ["Core remains pure"],
        success_criteria: ["Dry-run JSON is deterministic"],
        scaffold_notes: ["TODO: Add rollout constraints."],
        provenance: {
          source_type: "planner_inference",
          source_reference: "planning/intake/refined-brief.md",
          created_by: "theplanner plan --dry-run",
          confidence: "medium"
        }
      },
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

    expect(graph.productIntent).toMatchObject({
      summary: "Build a repository-native planning CLI.",
      targetUsers: ["Solo maintainers"],
      goals: ["Generate reviewable planning graphs"],
      mvpScope: ["Plan from a refined brief"],
      nonGoals: ["Live tracker sync"],
      constraints: ["Core remains pure"],
      successCriteria: ["Dry-run JSON is deterministic"],
      scaffoldNotes: ["TODO: Add rollout constraints."]
    });
    expect(serializePlanningGraphJson(graph)).toMatchObject({
      product_intent: {
        summary: "Build a repository-native planning CLI.",
        target_users: ["Solo maintainers"],
        goals: ["Generate reviewable planning graphs"],
        mvp_scope: ["Plan from a refined brief"],
        non_goals: ["Live tracker sync"],
        constraints: ["Core remains pure"],
        success_criteria: ["Dry-run JSON is deterministic"],
        scaffold_notes: ["TODO: Add rollout constraints."]
      }
    });
  });
});
