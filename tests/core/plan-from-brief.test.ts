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
    expect(first.graph.productIntent).toEqual({
      summary: "Build a CLI-first ThePlanner workflow that turns a refined brief into a repository-native Planning Graph.",
      targetUsers: ["Solo maintainers and engineering leads planning agent-assisted software work."],
      goals: [
        "Produce deterministic local planning artifacts that can be reviewed in Git.",
        "Keep graph validation and readiness labels explicit before any coding agent runs."
      ],
      mvpScope: [
        "Support a planner CLI dry run that reads a refined brief and proposes a valid Planning Graph.",
        "Include requirements, Work Items, execution slices, dependency views, and document projection nodes."
      ],
      nonGoals: ["Do not call live LLM providers.", "Do not sync external trackers."],
      constraints: [
        "Core graph logic must remain pure TypeScript domain code without filesystem access.",
        "Risk: inferred plans may be too coarse when the brief leaves implementation detail unknown."
      ],
      successCriteria: ["The dry run prints deterministic JSON and does not mutate repository files."],
      scaffoldNotes: [],
      provenance: {
        sourceType: "planner_inference",
        sourceReference: "tests/fixtures/intake/refined-brief.md",
        createdBy: "theplanner plan --dry-run",
        confidence: "medium"
      }
    });
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

  it("adds deterministic scaffold notes for missing PRD inputs", () => {
    const proposal = proposePlanningGraphFromBrief({
      sourcePath: "brief.md",
      content: ["# Refined Brief", "", "## Product Summary", "", "Build a local planning CLI."].join("\n")
    });

    expect(proposal.graph.productIntent).toMatchObject({
      summary: "Build a local planning CLI.",
      targetUsers: ["TODO: Identify target users."],
      goals: ["TODO: Define product goals."],
      nonGoals: ["TODO: Define non-goals."],
      constraints: ["TODO: Define constraints."],
      successCriteria: ["TODO: Define success criteria."],
      scaffoldNotes: [
        "TODO: Identify primary users, secondary users, and users explicitly out of scope.",
        "TODO: Define the product and user outcomes this plan should achieve.",
        "TODO: Define the smallest coherent scope for the first implementation slice.",
        "TODO: List capabilities, audiences, and integrations intentionally deferred.",
        "TODO: Capture technical, operational, legal, team, and timeline constraints.",
        "TODO: Add measurable signals that prove the MVP solved the right problem."
      ]
    });
    expect(proposal.scaffoldedFields).toContain("Product intent Users scaffolded because Users was empty.");
    expect(validatePlanningGraph(proposal.graph).status).toBe("pass");
  });
});
