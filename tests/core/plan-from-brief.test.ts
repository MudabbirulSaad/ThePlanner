import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { proposePlanningGraphFromBrief, renderAllProjections, validatePlanningGraph } from "../../src/core/index.js";

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
    expect(first.graph.nodes.filter((node) => node.kind === "component")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "comp-002",
          interfaces: [
            {
              name: "Domain API",
              direction: "internal",
              contract: "Pure TypeScript functions transform graph inputs without filesystem or process access."
            }
          ],
          constraints: [
            "Core graph logic must remain pure TypeScript domain code without filesystem access."
          ],
          risks: [
            "Risk: inferred plans may be too coarse when the brief leaves implementation detail unknown."
          ]
        })
      ])
    );
    expect(first.graph.nodes.filter((node) => node.kind === "work_item")).toHaveLength(3);
    expect(first.graph.nodes.filter((node) => node.kind === "document_projection").map((node) => node.id)).toEqual([
      "doc-001",
      "doc-002",
      "doc-003",
      "doc-004"
    ]);
    expect(first.graph.nodes.filter((node) => node.kind === "execution_slice")).toHaveLength(1);
  });

  it("extracts accepted and unresolved Decisions from refined brief decision language", () => {
    const proposal = proposePlanningGraphFromBrief({
      sourcePath: "brief.md",
      content: [
        "# Refined Brief",
        "",
        "## Product Summary",
        "",
        "Build a repository planning assistant.",
        "",
        "## MVP Scope",
        "",
        "Generate planning graphs and RFC projections.",
        "",
        "## Success Criteria",
        "",
        "Generated artifacts are deterministic.",
        "",
        "## Decisions",
        "",
        "- Accepted: Use local Markdown projections. Rationale: Keeps review Git-native. Alternatives: database-backed docs, hosted wiki.",
        "- Proposed: Use GitHub Issues sync. Rationale: Teams may want tracker visibility. Alternatives: Linear sync. Questions: Which tracker fields are required?",
        "- Revisit: Use a web approval UI. Rationale: CLI review may be enough for V1. Alternatives: editor extension. Questions: When does interactive approval become necessary?"
      ].join("\n")
    });

    const decisions = proposal.graph.nodes.filter((node) => node.kind === "decision");
    expect(decisions).toEqual([
      expect.objectContaining({
        id: "dec-001",
        status: "accepted",
        selectedOption: "Use local Markdown projections.",
        rationale: "Keeps review Git-native.",
        rejectedAlternatives: ["database-backed docs", "hosted wiki."],
        unresolvedQuestions: []
      }),
      expect.objectContaining({
        id: "dec-002",
        status: "proposed",
        selectedOption: "Use GitHub Issues sync.",
        unresolvedQuestions: ["Which tracker fields are required?"]
      }),
      expect.objectContaining({
        id: "dec-003",
        status: "revisit",
        selectedOption: "Use a web approval UI.",
        unresolvedQuestions: ["When does interactive approval become necessary?"]
      })
    ]);
    expect(proposal.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "wi-001", target: "dec-001", type: "references" }),
        expect.objectContaining({ source: "wi-001", target: "dec-002", type: "depends_on" }),
        expect.objectContaining({ source: "wi-002", target: "dec-003", type: "depends_on" })
      ])
    );
    expect(validatePlanningGraph(proposal.graph).readinessSnapshots["wi-001"]?.labels).toEqual([
      "agent_eligible",
      "hitl_gated",
      "blocked"
    ]);
  });

  it("derives HITL Gates from blocking assumptions, risks, decisions, and open questions", () => {
    const proposal = proposePlanningGraphFromBrief({
      sourcePath: "brief.md",
      content: [
        "# Refined Brief",
        "",
        "## Product Summary",
        "",
        "Build a planning assistant for migration work.",
        "",
        "## MVP Scope",
        "",
        "Generate Work Items for the first migration slice.",
        "",
        "## Success Criteria",
        "",
        "Generated Work Items explain blockers before agent execution.",
        "",
        "## Assumptions",
        "",
        "- Assumption: The production schema is final. Confidence: low. Impact if wrong: Work targets the wrong tables. Blocks AFK.",
        "",
        "## Constraints",
        "",
        "- Risk: high impact data migration rollback may be unavailable and blocks execution.",
        "",
        "## Decisions",
        "",
        "- Proposed: Use batch migration. Rationale: Cheapest path. Questions: What maintenance window is allowed?",
        "",
        "## Open Questions",
        "",
        "- Which production freeze window must be decided before execution?"
      ].join("\n")
    });

    const validation = validatePlanningGraph(proposal.graph);
    const hitlGates = proposal.graph.nodes.filter((node) => node.kind === "hitl_gate");

    expect(validation.status).toBe("pass");
    expect(hitlGates).toEqual([
      expect.objectContaining({ id: "hitl-001", title: "Resolve blocking Assumption asm-001" }),
      expect.objectContaining({ id: "hitl-002", title: "Resolve high-impact Risk risk-001" }),
      expect.objectContaining({ id: "hitl-003", title: "Accept unresolved Decision dec-001" }),
      expect.objectContaining({ id: "hitl-004", title: "Answer execution-blocking Open Question oq-001" })
    ]);
    expect(
      proposal.graph.edges.filter((edge) => edge.source.startsWith("hitl-") && edge.type === "references").map((edge) => edge.target)
    ).toEqual(["asm-001", "risk-001", "dec-001", "oq-001"]);
    expect(validation.readinessSnapshots["wi-001"]?.labels).toEqual([
      "agent_eligible",
      "hitl_gated",
      "blocked"
    ]);
    expect(validation.readinessSnapshots["wi-001"]?.reasons).toContain("Blocked by unresolved HITL Gate hitl-001.");

    const renderedWorkItem = renderAllProjections(proposal.graph).find((projection) =>
      projection.path.includes("wi-001-")
    );
    expect(renderedWorkItem?.content).toContain("hitl_gates: [hitl-001, hitl-002, hitl-003, hitl-004]");
    expect(renderedWorkItem?.content).toContain("## HITL Gates");
    expect(renderedWorkItem?.content).toContain("Required action: Confirm or revise Assumption asm-001");
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
