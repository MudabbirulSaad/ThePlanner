import { describe, expect, it } from "vitest";

import {
  buildAgentContextSections,
  parsePlanningGraphJson,
  renderAgentContextBundle,
  renderAgentContextMarkdown,
  selectExecutionSliceContext,
  validationCommandsForWorkItem
} from "../../src/application/index.js";

const graph = parsePlanningGraphJson({
  schema_version: "0.1.0",
  graph_version: 7,
  nodes: {
    requirements: [
      { id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" },
      {
        id: "req-999",
        title: "Unrelated Requirement",
        type: "functional",
        statement: "Unrelated PRD-only content must stay out.",
        status: "active"
      }
    ],
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
      },
      {
        id: "wi-002",
        title: "Completed Dependency",
        execution_state: "done",
        readiness_snapshot: {
          graph_version: 7,
          labels: ["agent_eligible", "afk_ready"],
          reasons: ["Work Item is complete and already validated."]
        },
        context_summary: "Already complete.",
        boundary_notes: ["No active changes."],
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }],
        safe_failure_guidance: "Stop."
      }
    ],
    decisions: [
      {
        id: "dec-001",
        title: "Accepted Decision",
        status: "accepted",
        selected_option: "Keep the selector in the application layer.",
        rationale: "Bundle construction orchestrates projections and local instructions.",
        rejected_alternatives: [],
        unresolved_questions: []
      },
      {
        id: "dec-999",
        title: "Unrelated Decision",
        status: "accepted",
        selected_option: "Do not include this.",
        rationale: "Unrelated RFC content must stay out.",
        rejected_alternatives: [],
        unresolved_questions: []
      }
    ],
    assumptions: [],
    risks: [
      {
        id: "risk-001",
        title: "Scoped Risk",
        likelihood: "low",
        impact: "medium",
        mitigation: "Keep generated context narrow.",
        blocks_afk: false
      },
      {
        id: "risk-999",
        title: "Unrelated Risk",
        likelihood: "low",
        impact: "low",
        mitigation: "Should not appear.",
        blocks_afk: false
      }
    ],
    open_questions: [
      {
        id: "oq-001",
        title: "Scoped Question",
        question: "Does the selector keep immediate dependencies?",
        priority: "medium",
        blocks_execution: false
      }
    ],
    hitl_gates: [
      {
        id: "hitl-001",
        title: "Resolved Review",
        status: "resolved",
        required_action: "Confirm context selector scope.",
        blocks: ["wi-001"],
        resolved_at: "2026-05-30T00:00:00.000Z",
        resolution: "Scope confirmed."
      }
    ],
    components: [
      {
        id: "comp-001",
        title: "Context Builder",
        status: "active",
        responsibility: "Build scoped agent context bundles.",
        interfaces: [],
        depends_on: [],
        constraints: [],
        risks: []
      }
    ],
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
    execution_slices: [
      {
        id: "slice-001",
        title: "Context Selector Slice",
        work_items: ["wi-001", "wi-002"],
        readiness_summary: "Implement the scoped context selector."
      }
    ]
  },
  edges: [
    { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
    { source: "wi-001", target: "wi-002", type: "depends_on", rationale: "Completed prerequisite." },
    { source: "wi-001", target: "dec-001", type: "references", rationale: "Architecture choice." },
    { source: "wi-001", target: "comp-001", type: "references", rationale: "Component touched by this slice." },
    { source: "wi-001", target: "risk-001", type: "mitigates", rationale: "Selector narrows context risk." },
    { source: "wi-001", target: "oq-001", type: "references", rationale: "Question answered by this slice." },
    { source: "hitl-001", target: "risk-001", type: "references", rationale: "Review was caused by context risk." },
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
  it("selects AGENTS.md, Work Item, execution slice context, and dependency view in deterministic order", async () => {
    const context = await buildAgentContextSections({
      graph,
      workItem,
      contextFileReader: { readIfExists: async () => "# Repo Instructions\n\nStay in scope.\n" }
    });

    expect(context.map((section) => ({ path: section.path, source: section.source }))).toEqual([
      { path: "AGENTS.md", source: "workspace" },
      { path: "planning/work-items/wi-001-context-bundle.md", source: "generated" },
      { path: "planning/execution-context/wi-001.md", source: "generated" },
      { path: "planning/dependencies.md", source: "generated" }
    ]);
    expect(context.map((section) => section.content).join("\n")).toContain("slice-001: Context Selector Slice");
    expect(context.map((section) => section.content).join("\n")).toContain("req-001 (functional, active): Requirement. Do it.");
    expect(context.map((section) => section.content).join("\n")).toContain("wi-001 depends_on wi-002: Completed prerequisite.");
    expect(context.map((section) => section.content).join("\n")).not.toContain("Unrelated PRD-only content must stay out.");
    expect(context.map((section) => section.content).join("\n")).not.toContain("Unrelated RFC content must stay out.");
    expect(context.map((section) => section.content).join("\n")).not.toContain("docs/architecture/context.md");
  });

  it("deep-clones the selected context graph and leaves the canonical graph immutable", () => {
    const selection = selectExecutionSliceContext(graph, workItem);
    const selectedWorkItem = selection.graph.nodes.find((node) => node.kind === "work_item" && node.id === workItem.id);
    if (!selectedWorkItem || selectedWorkItem.kind !== "work_item") {
      throw new Error("Selected Work Item missing.");
    }

    (selectedWorkItem.acceptanceCriteria as string[]).push("Mutating the selection must not mutate the canonical graph.");

    expect(workItem.acceptanceCriteria).toEqual(["Bundle is deterministic."]);
    expect(selection.graph.nodes.map((node) => node.id)).toEqual([
      "comp-001",
      "dec-001",
      "doc-deps-a",
      "hitl-001",
      "oq-001",
      "req-001",
      "risk-001",
      "slice-001",
      "wi-001",
      "wi-002"
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
