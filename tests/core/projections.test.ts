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

  it("renders a PRD-grade Markdown projection from graph fields", () => {
    const graph = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 2,
      product_intent: {
        summary:
          "Build a CLI that turns a refined intake brief into reviewable planning artifacts.",
        target_users: ["Solo maintainers", "Coding agents"],
        goals: ["Create a canonical graph", "Export human-reviewable documents"],
        mvp_scope: ["Plan from a refined brief", "Export PRD projections"],
        non_goals: ["Live LLM calls"],
        constraints: ["Core stays independent from adapters"],
        success_criteria: ["Dry-run export output is deterministic"],
        scaffold_notes: ["Confirm rollout guidance before implementation."]
      },
      nodes: {
        requirements: [
          {
            id: "req-001",
            title: "Export a PRD",
            type: "functional",
            statement: "The planner must render a product requirements document from graph fields.",
            status: "active"
          }
        ],
        assumptions: [
          {
            id: "asm-001",
            title: "Markdown review is acceptable",
            statement: "Human reviewers can review generated Markdown directly.",
            confidence: "medium",
            impact_if_wrong: "The workflow needs an editor integration.",
            blocks_afk: false
          }
        ],
        risks: [
          {
            id: "risk-001",
            title: "Generated docs drift",
            likelihood: "medium",
            impact: "high",
            mitigation: "Keep the Planning Graph canonical and regenerate projections.",
            blocks_afk: true
          }
        ],
        open_questions: [
          {
            id: "oq-001",
            title: "Reviewer format",
            question: "Which PRD sections are mandatory for review?",
            priority: "high",
            blocks_execution: true
          }
        ],
        work_items: [
          {
            id: "wi-001",
            title: "Render PRD projection",
            execution_state: "ready",
            readiness_snapshot: {
              labels: ["agent_eligible", "afk_ready"],
              reasons: ["Scope and validation are explicit."]
            },
            acceptance_criteria: ["PRD includes traceable planning sections"],
            validation_methods: [{ type: "test", expected_result: "Golden PRD projection passes" }]
          }
        ],
        document_projections: [
          {
            id: "doc-001",
            title: "Repository Planner PRD",
            path: "docs/prd/repository-planner.md",
            projection_type: "prd"
          }
        ]
      },
      edges: [
        {
          source: "wi-001",
          target: "req-001",
          type: "satisfies",
          rationale: "The Work Item renders the PRD requirement."
        }
      ]
    });
    const rendered = renderAllProjections(graph).find(
      (projection) => projection.path === "docs/prd/repository-planner.md"
    );

    expect(rendered?.content).toBe(readFileSync("tests/golden/prd-projection.md", "utf8"));
  });
});
