import { describe, expect, it } from "vitest";

import {
  buildAgentContextSections,
  parsePlanningGraphJson,
  renderAgentContextBundle,
  renderAgentContextMarkdown,
  validationCommandsForWorkItem
} from "../../src/application/index.js";

const graph = parsePlanningGraphJson({
  schema_version: "0.1.0",
  graph_version: 7,
  nodes: {
    requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
    work_items: [
      {
        id: "wi-001",
        title: "Context Bundle",
        execution_state: "backlog",
        readiness_snapshot: {
          graph_version: 7,
          labels: ["agent_eligible", "afk_ready"],
          reasons: ["Dependencies are complete."]
        },
        context_summary: "Prepare scoped handoff context.",
        boundary_notes: ["Keep changes inside the context bundle module."],
        acceptance_criteria: ["Bundle is deterministic."],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }],
        safe_failure_guidance: "Stop and report missing context before changing behavior."
      }
    ],
    decisions: [],
    assumptions: [],
    risks: [],
    open_questions: [],
    hitl_gates: [],
    components: [],
    document_projections: [
      {
        id: "doc-deps-z",
        title: "Later Dependencies",
        status: "active",
        path: "planning/z-dependencies.md",
        projection_type: "dependency_view"
      },
      {
        id: "doc-rfc",
        title: "RFC",
        status: "active",
        path: "docs/rfc/001-context.md",
        projection_type: "rfc"
      },
      {
        id: "doc-arch",
        title: "Architecture",
        status: "active",
        path: "docs/architecture/context.md",
        projection_type: "architecture"
      },
      {
        id: "doc-prd",
        title: "PRD",
        status: "active",
        path: "planning/prd.md",
        projection_type: "prd"
      },
      {
        id: "doc-deps-a",
        title: "Dependencies",
        status: "active",
        path: "planning/dependencies.md",
        projection_type: "dependency_view"
      }
    ],
    execution_slices: []
  },
  edges: [
    { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
    { source: "doc-deps-z", target: "wi-001", type: "references", rationale: "Generated dependency view." },
    { source: "doc-rfc", target: "wi-001", type: "references", rationale: "Generated RFC context." },
    { source: "doc-arch", target: "wi-001", type: "references", rationale: "Generated architecture context." },
    { source: "doc-prd", target: "wi-001", type: "references", rationale: "Generated PRD context." },
    { source: "doc-deps-a", target: "wi-001", type: "references", rationale: "Generated dependency view." }
  ]
});

const workItem = graph.nodes.find((node) => node.kind === "work_item" && String(node.id) === "wi-001");
if (!workItem || workItem.kind !== "work_item") {
  throw new Error("Fixture Work Item missing.");
}

describe("agent context bundle", () => {
  it("selects AGENTS.md, Work Item, dependency view, and related documents in deterministic order", async () => {
    const context = await buildAgentContextSections({
      graph,
      workItem,
      contextFileReader: { readIfExists: async () => "# Repo Instructions\n\nStay in scope.\n" }
    });

    expect(context.map((section) => ({ path: section.path, source: section.source }))).toEqual([
      { path: "AGENTS.md", source: "workspace" },
      { path: "planning/work-items/wi-001-context-bundle.md", source: "generated" },
      { path: "planning/dependencies.md", source: "generated" },
      { path: "docs/architecture/context.md", source: "generated" },
      { path: "docs/rfc/001-context.md", source: "generated" },
      { path: "planning/prd.md", source: "generated" }
    ]);
  });

  it("renders validation commands, readiness details, and scope reminders", () => {
    const content = renderAgentContextBundle({
      agent: "codex",
      mode: "prepare",
      graph,
      workItem,
      readiness: workItem.readinessSnapshot,
      validationCommands: validationCommandsForWorkItem(workItem, ["npm run check"]),
      context: [{ path: "AGENTS.md", source: "workspace", content: "# Repo Instructions\n" }]
    });

    expect(content).toContain("Paste this full bundle into Codex.");
    expect(content).toContain("## Readiness Details\n\n- Dependencies are complete.");
    expect(content).toContain("## Scope Reminder\n\n- Complete only Work Item wi-001.");
    expect(content).toContain("- Keep changes inside the context bundle module.");
    expect(content).toContain("- Preserve unrelated existing changes.");
    expect(content).toContain("- Do not call live LLM providers or external services unless the Work Item explicitly requires it.");
    expect(content).toContain("## Validation Commands\n\n- npm test");
    expect(content).toContain("Stop and report missing context before changing behavior.");
  });

  it("renders standalone context Markdown for persisted run artifacts", () => {
    expect(
      renderAgentContextMarkdown([{ path: "planning/work-items/wi-001-context-bundle.md", source: "generated", content: "Body" }])
    ).toBe(`# Agent Run Context

## planning/work-items/wi-001-context-bundle.md

Source: generated

\`\`\`markdown
Body
\`\`\`
`);
  });
});
