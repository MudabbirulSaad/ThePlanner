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

  it("round-trips architecture-grade component details", () => {
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
        components: [
          {
            id: "comp-001",
            title: "Planning graph core",
            responsibility: "Own planning graph validation and readiness derivation.",
            interfaces: [
              {
                name: "Domain API",
                direction: "internal",
                contract: "Pure functions accept graph input and return validation output."
              }
            ],
            depends_on: ["comp-002"],
            constraints: ["No filesystem access from core."],
            risks: ["Graph changes can break generated projections."],
            status: "active"
          },
          {
            id: "comp-002",
            title: "Projection renderer",
            responsibility: "Render graph-backed Markdown projections.",
            status: "active"
          }
        ],
        work_items: [],
        document_projections: [],
        execution_slices: []
      },
      edges: []
    });

    expect(graph.nodes.find((node) => `${node.id}` === "comp-001")).toMatchObject({
      kind: "component",
      interfaces: [
        {
          name: "Domain API",
          direction: "internal",
          contract: "Pure functions accept graph input and return validation output."
        }
      ],
      dependsOn: ["comp-002"],
      constraints: ["No filesystem access from core."],
      risks: ["Graph changes can break generated projections."]
    });
    expect(graph.nodes.find((node) => `${node.id}` === "comp-002")).toMatchObject({
      kind: "component",
      interfaces: [],
      dependsOn: [],
      constraints: [],
      risks: []
    });
    expect(serializePlanningGraphJson(graph)).toMatchObject({
      nodes: {
        components: [
          {
            id: "comp-001",
            interfaces: [
              {
                name: "Domain API",
                direction: "internal",
                contract: "Pure functions accept graph input and return validation output."
              }
            ],
            depends_on: ["comp-002"],
            constraints: ["No filesystem access from core."],
            risks: ["Graph changes can break generated projections."]
          },
          {
            id: "comp-002",
            interfaces: [],
            depends_on: [],
            constraints: [],
            risks: []
          }
        ]
      }
    });
  });
});
