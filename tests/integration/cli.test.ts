import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPlannerCli } from "../../src/application/index.js";
import { parsePlanningGraphJson } from "../../src/application/index.js";
import { FileIntakeIdeaReader, FileRefinedBriefWriter, FileWorkspaceInitializer } from "../../src/adapters/index.js";
import { renderWorkItemProjection } from "../../src/core/index.js";
import { validatePlanningGraph } from "../../src/core/index.js";
import type { PlanningChangeLogEvent } from "../../src/application/index.js";
import type { PlanningGraph } from "../../src/core/index.js";

const graph = parsePlanningGraphJson({
  schema_version: "0.1.0",
  graph_version: 1,
  nodes: {
    requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
    work_items: [
      {
        id: "wi-001",
        title: "Work",
        execution_state: "backlog",
        readiness_snapshot: { graph_version: 1, labels: ["agent_eligible"], reasons: [] },
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
      }
    ],
    decisions: [],
    assumptions: [],
    risks: [],
    open_questions: [],
    hitl_gates: [],
    components: [],
    document_projections: [],
    execution_slices: []
  },
  edges: [{ source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." }]
});

describe("planner CLI use case wiring", () => {
  it("supports status JSON output through application use cases", async () => {
    const result = await runPlannerCli(["status", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ graphVersion: 1, status: "pass" });
  });

  it("initializes a workspace and preserves existing files on rerun", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-init-"));

    try {
      process.chdir(workspace);

      const first = await runPlannerCli(["init", "--json"], {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        workspaceInitializer: new FileWorkspaceInitializer()
      });

      expect(first.exitCode).toBe(0);
      expect(JSON.parse(first.stdout)).toMatchObject({
        created: [
          "planning",
          "planning/intake",
          "planning/work-items",
          "planning/execution-slices",
          "docs/prd",
          "docs/rfc",
          "docs/architecture",
          "planning/intake/idea.md",
          "planning/change-log.ndjson",
          "planning/graph.json"
        ]
      });

      const graphJson = JSON.parse(await readFile("planning/graph.json", "utf8"));
      expect(validatePlanningGraph(parsePlanningGraphJson(graphJson)).status).toBe("pass");
      expect(await readFile("planning/intake/idea.md", "utf8")).toContain("## Target Users");

      await writeFile("planning/intake/idea.md", "do not overwrite\n", "utf8");
      const second = await runPlannerCli(["init", "--json"], {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        workspaceInitializer: new FileWorkspaceInitializer()
      });

      expect(second.exitCode).toBe(0);
      expect(JSON.parse(second.stdout).existing).toContain("planning/intake/idea.md");
      expect(await readFile("planning/intake/idea.md", "utf8")).toBe("do not overwrite\n");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("renders deterministic intake questions from an idea file as JSON", async () => {
    const result = await runPlannerCli(
      ["intake", "questions", "--from", "tests/fixtures/intake/short-idea.md", "--json"],
      {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        intakeIdeaReader: new FileIntakeIdeaReader()
      }
    );

    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.sourcePath).toBe("tests/fixtures/intake/short-idea.md");
    expect(output.groups).toHaveLength(7);
    expect(output.groups[0]).toMatchObject({
      id: "target_user",
      title: "Target User",
      questions: [
        {
          id: "target_user.primary_user",
          question: "Who is the primary target user, and what role or context are they in when they need this?"
        },
        {
          id: "target_user.current_workaround",
          question: "How does that user solve or work around the problem today?"
        },
        {
          id: "target_user.excluded_users",
          question: "Which users or audiences are explicitly not being optimized for in the first version?"
        }
      ]
    });
  });

  it("renders high-level human-readable intake questions", async () => {
    const result = await runPlannerCli(["intake", "questions", "--from", "tests/fixtures/intake/short-idea.md"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      intakeIdeaReader: new FileIntakeIdeaReader()
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("# Intake Grilling Questions");
    expect(result.stdout).toContain("## MVP Scope");
    expect(result.stdout).toContain("How to use with an agent:");
  });

  it("creates a refined brief file and reports JSON paths", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-refine-"));

    try {
      process.chdir(workspace);
      await writeFile("idea.md", "Build a planning graph tool.\n", "utf8");

      const result = await runPlannerCli(
        ["intake", "refine", "--from", "idea.md", "--out", "planning/intake/refined-brief.md", "--json"],
        {
          graphRepository: { load: async () => graph },
          projectionWriter: { writeAll: async () => undefined },
          intakeIdeaReader: new FileIntakeIdeaReader(),
          refinedBriefWriter: new FileRefinedBriefWriter()
        }
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "created",
        created: ["planning/intake/refined-brief.md"],
        skipped: [],
        sourcePath: "idea.md",
        outPath: "planning/intake/refined-brief.md",
        deferred: true
      });
      const refinedBrief = await readFile("planning/intake/refined-brief.md", "utf8");
      expect(refinedBrief).toContain("# Refined Brief");
      expect(refinedBrief).toContain("## Product Summary");
      expect(refinedBrief).toContain("## Open Questions");
      expect(refinedBrief).toContain("Build a planning graph tool.");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("does not overwrite an existing refined brief without force", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-refine-skip-"));

    try {
      process.chdir(workspace);
      await writeFile("idea.md", "New raw idea\n", "utf8");
      await writeFile("refined-brief.md", "existing user brief\n", "utf8");

      const result = await runPlannerCli(
        ["intake", "refine", "--from", "idea.md", "--out", "refined-brief.md", "--json"],
        {
          graphRepository: { load: async () => graph },
          projectionWriter: { writeAll: async () => undefined },
          intakeIdeaReader: new FileIntakeIdeaReader(),
          refinedBriefWriter: new FileRefinedBriefWriter()
        }
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "skipped",
        created: [],
        skipped: ["refined-brief.md"]
      });
      expect(await readFile("refined-brief.md", "utf8")).toBe("existing user brief\n");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("returns a useful error for missing intake idea files", async () => {
    const result = await runPlannerCli(["intake", "questions", "--from", "tests/fixtures/intake/missing.md"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      intakeIdeaReader: new FileIntakeIdeaReader()
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Intake idea file not found: tests/fixtures/intake/missing.md\n");
  });

  it("reports projection paths returned by the writer during export", async () => {
    const result = await runPlannerCli(["export", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => ["planning/work-items/wi-001-existing-name.md"] }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      exported: ["planning/work-items/wi-001-existing-name.md"]
    });
  });

  it("supports reconcile JSON output without applying graph mutations", async () => {
    let saved: PlanningGraph | undefined;
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    const result = await runPlannerCli(["reconcile", "--json"], {
      graphRepository: { load: async () => graph, save: async (next) => { saved = next; } },
      projectionWriter: { writeAll: async () => undefined },
      projectionReader: {
        readMany: async () => [
          { ...projection, content: projection.content.replace("title: Work", "title: Renamed work") }
        ]
      },
      changeLogWriter: { append: async () => undefined }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      applied: false,
      proposedPatches: [{ operation: "replace_work_item_title", nodeId: "wi-001" }]
    });
    expect(saved).toBeUndefined();
  });

  it("supports reconcile apply JSON output and writes a change-log event", async () => {
    let saved: PlanningGraph | undefined;
    let event: PlanningChangeLogEvent | undefined;
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    const result = await runPlannerCli(["reconcile", "--apply", "--json"], {
      graphRepository: { load: async () => graph, save: async (next) => { saved = next; } },
      projectionWriter: { writeAll: async () => undefined },
      projectionReader: {
        readMany: async () => [
          { ...projection, content: projection.content.replace("title: Work", "title: Renamed work") }
        ]
      },
      changeLogWriter: { append: async (nextEvent) => { event = nextEvent; } }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ applied: true, graphVersion: 2 });
    expect(saved?.graphVersion).toBe(2);
    expect(event).toMatchObject({
      graph_version_before: 1,
      graph_version_after: 2,
      affected_node_ids: ["wi-001"]
    });
  });
});
