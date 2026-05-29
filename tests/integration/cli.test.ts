import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPlannerCli } from "../../src/application/index.js";
import { parsePlanningGraphJson } from "../../src/application/index.js";
import { serializePlanningGraphJson } from "../../src/application/index.js";
import {
  FileChangeLogWriter,
  FileContextReader,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FilePlanningGraphSchemaValidator,
  FileProjectionReader,
  FileProjectionWriter,
  FileRefinedBriefReader,
  FileRefinedBriefWriter,
  FileWorkspaceInitializer
} from "../../src/adapters/index.js";
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

  it("runs runtime JSON Schema validation before semantic validation", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-schema-pass-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");

      const result = await runPlannerCli(["validate", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        graphSchemaValidator: new FilePlanningGraphSchemaValidator(join(originalCwd, "planning/graph.schema.json")),
        projectionWriter: { writeAll: async () => undefined }
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "pass",
        schemaStatus: "pass",
        schemaErrors: []
      });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("reports schema errors and skips semantic validation for malformed graph shape", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-schema-fail-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile(
        "planning/graph.json",
        `${JSON.stringify(
          {
            schema_version: "0.1.0",
            graph_version: 1,
            nodes: {
              requirements: []
            },
            edges: [{ source: "wi-missing", target: "req-missing", type: "satisfies", rationale: "Would fail semantically." }]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const result = await runPlannerCli(["validate", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        graphSchemaValidator: new FilePlanningGraphSchemaValidator(join(originalCwd, "planning/graph.schema.json")),
        projectionWriter: { writeAll: async () => undefined }
      });

      const output = JSON.parse(result.stdout);
      expect(result.exitCode).toBe(1);
      expect(output).toMatchObject({
        status: "error",
        schemaStatus: "error",
        semanticErrors: [],
        semanticWarnings: []
      });
      expect(output.schemaErrors.map((error: { message: string }) => error.message)).toContain(
        "$.nodes: missing required property decisions"
      );
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
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
          "planning/graph.schema.json",
          "planning/graph.json"
        ]
      });

      const graphJson = JSON.parse(await readFile("planning/graph.json", "utf8"));
      expect(JSON.parse(await readFile("planning/graph.schema.json", "utf8"))).toMatchObject({
        title: "AI Engineering Planner Graph"
      });
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

  it("prints a valid plan proposal in dry-run JSON without writing files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-plan-dry-run-"));

    try {
      process.chdir(workspace);
      await writeFile("refined-brief.md", await readFile(join(originalCwd, "tests/fixtures/intake/refined-brief.md"), "utf8"), "utf8");
      const before = await listWorkspaceFiles(".");

      const result = await runPlannerCli(["plan", "--from", "refined-brief.md", "--dry-run", "--json"], {
        graphRepository: { load: async () => graph, save: async () => { throw new Error("dry-run must not save"); } },
        projectionWriter: { writeAll: async () => { throw new Error("dry-run must not export"); } },
        refinedBriefReader: new FileRefinedBriefReader()
      });

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        status: "proposed",
        dryRun: true,
        sourcePath: "refined-brief.md",
        graph: {
          schema_version: "0.1.0",
          graph_version: 1,
          source: "refined-brief.md"
        }
      });
      expect(validatePlanningGraph(parsePlanningGraphJson(output.graph)).status).toBe("pass");
      expect(output.graph.nodes.work_items).toHaveLength(3);
      expect(output.graph.nodes.document_projections).toHaveLength(3);
      expect(await listWorkspaceFiles(".")).toEqual(before);
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("applies a refined brief plan, writes graph.json, and records a change-log event", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-plan-apply-"));

    try {
      process.chdir(workspace);
      await mkdir("planning/intake", { recursive: true });
      await writeFile("planning/intake/refined-brief.md", await readFile(join(originalCwd, "tests/fixtures/intake/refined-brief.md"), "utf8"), "utf8");

      const result = await runPlannerCli(
        ["plan", "--from", "planning/intake/refined-brief.md", "--apply", "--json"],
        {
          graphRepository: new FilePlanningGraphRepository(),
          projectionWriter: { writeAll: async () => undefined },
          refinedBriefReader: new FileRefinedBriefReader(),
          changeLogWriter: new FileChangeLogWriter()
        }
      );

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        status: "applied",
        dryRun: false,
        applied: true,
        sourcePath: "planning/intake/refined-brief.md",
        graph: {
          schema_version: "0.1.0",
          graph_version: 1,
          source: "planning/intake/refined-brief.md"
        },
        event: {
          graph_version_before: 0,
          graph_version_after: 1,
          operation_type: "graph_creation_from_brief",
          approval_status: "applied"
        }
      });

      const savedGraph = parsePlanningGraphJson(JSON.parse(await readFile("planning/graph.json", "utf8")));
      expect(validatePlanningGraph(savedGraph).status).toBe("pass");

      const events = (await readFile("planning/change-log.ndjson", "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        graph_version_before: 0,
        graph_version_after: 1,
        operation_type: "graph_creation_from_brief"
      });

      const validate = await runPlannerCli(["validate", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        graphSchemaValidator: new FilePlanningGraphSchemaValidator(join(originalCwd, "planning/graph.schema.json")),
        projectionWriter: { writeAll: async () => undefined }
      });
      expect(validate.exitCode).toBe(0);
      expect(JSON.parse(validate.stdout)).toMatchObject({ status: "pass", schemaStatus: "pass", graphVersion: 1 });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("refuses to apply a refined brief over an existing non-empty graph", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-plan-protect-"));

    try {
      process.chdir(workspace);
      await mkdir("planning/intake", { recursive: true });
      await writeFile("planning/intake/refined-brief.md", await readFile(join(originalCwd, "tests/fixtures/intake/refined-brief.md"), "utf8"), "utf8");
      await new FilePlanningGraphRepository().save(graph);
      await writeFile("planning/change-log.ndjson", "", "utf8");

      const result = await runPlannerCli(
        ["plan", "--from", "planning/intake/refined-brief.md", "--apply", "--json"],
        {
          graphRepository: new FilePlanningGraphRepository(),
          projectionWriter: { writeAll: async () => undefined },
          refinedBriefReader: new FileRefinedBriefReader(),
          changeLogWriter: new FileChangeLogWriter()
        }
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("Refusing to overwrite existing non-empty planning/graph.json without an explicit force/update path.\n");
      expect(parsePlanningGraphJson(JSON.parse(await readFile("planning/graph.json", "utf8"))).nodes).toHaveLength(graph.nodes.length);
      expect(await readFile("planning/change-log.ndjson", "utf8")).toBe("");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("returns a useful error for missing and empty refined briefs", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-plan-errors-"));

    try {
      process.chdir(workspace);
      const missing = await runPlannerCli(["plan", "--from", "missing.md", "--dry-run", "--json"], {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        refinedBriefReader: new FileRefinedBriefReader()
      });
      expect(missing.exitCode).toBe(1);
      expect(missing.stderr).toBe("Refined brief file not found: missing.md\n");

      await writeFile("empty.md", "\n", "utf8");
      const empty = await runPlannerCli(["plan", "--from", "empty.md", "--dry-run", "--json"], {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        refinedBriefReader: new FileRefinedBriefReader()
      });
      expect(empty.exitCode).toBe(1);
      expect(empty.stderr).toBe("Refined brief is empty: empty.md\n");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("reports projection paths returned by the writer during export", async () => {
    const result = await runPlannerCli(["export", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => ["planning/work-items/wi-001-existing-name.md"] }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      dryRun: false,
      applied: true,
      exported: ["planning/work-items/wi-001-existing-name.md"]
    });
  });

  it("previews projection export without writing files", async () => {
    const writes: string[] = [];
    const result = await runPlannerCli(["export", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: {
        writeAll: async () => {
          writes.push("write");
          throw new Error("dry-run must not write projections");
        }
      },
      projectionReader: {
        readMany: async () => [],
        readExistingMany: async (paths) =>
          paths.map((path) => ({
            requestedPath: path,
            path
          }))
      }
    });

    expect(result.exitCode).toBe(0);
    expect(writes).toEqual([]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      dryRun: true,
      applied: false,
      created: ["planning/work-items/wi-001-work.md"],
      updated: [],
      unchanged: [],
      humanAuthoredWarnings: []
    });
  });

  it("reports updated projection sections that apply may overwrite", async () => {
    const workItem = graph.nodes.find((node) => node.kind === "work_item");
    if (!workItem || workItem.kind !== "work_item") {
      throw new Error("Fixture Work Item missing.");
    }
    const projection = renderWorkItemProjection(graph, workItem);

    const result = await runPlannerCli(["export", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      projectionReader: {
        readMany: async () => [],
        readExistingMany: async () => [
          {
            requestedPath: projection.path,
            path: projection.path,
            content: projection.content.replace("Use the Planning Graph as the source of truth.", "Manual note.")
          }
        ]
      }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      updated: ["planning/work-items/wi-001-work.md"],
      humanAuthoredWarnings: [
        {
          path: "planning/work-items/wi-001-work.md",
          sections: ["Agent Notes"]
        }
      ]
    });
  });

  it("prepares a deterministic agent context bundle in dry-run mode without writing artifacts", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-prepare-"));
    const graphWithDocuments = parsePlanningGraphJson({
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
        document_projections: [
          {
            id: "doc-001",
            title: "Dependencies",
            status: "active",
            path: "planning/dependencies.md",
            projection_type: "dependency_view"
          },
          {
            id: "doc-002",
            title: "Architecture",
            status: "active",
            path: "docs/architecture/proposed-architecture.md",
            projection_type: "architecture"
          }
        ],
        execution_slices: []
      },
      edges: [
        { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
        { source: "doc-001", target: "wi-001", type: "references", rationale: "Generated dependency view." },
        { source: "doc-002", target: "wi-001", type: "references", rationale: "Generated architecture context." }
      ]
    });

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("AGENTS.md", "# Repo Instructions\n\nStay in scope.\n", "utf8");
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graphWithDocuments), null, 2)}\n`, "utf8");
      const before = await listWorkspaceFiles(".");

      const result = await runPlannerCli(["prepare", "wi-001", "--agent", "codex", "--dry-run", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => { throw new Error("prepare dry-run must not write projections"); } },
        contextFileReader: new FileContextReader()
      });

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        status: "prepared",
        dryRun: true,
        applied: false,
        agent: "codex",
        workItemId: "wi-001",
        bundlePath: null,
        validationCommands: ["npm test"],
        context: [
          { path: "AGENTS.md", source: "workspace" },
          { path: "planning/work-items/wi-001-work.md", source: "generated" },
          { path: "planning/dependencies.md", source: "generated" },
          { path: "docs/architecture/proposed-architecture.md", source: "generated" }
        ]
      });
      expect(output.content).toContain("# Agent Context Bundle");
      expect(output.content).toContain("Paste this full bundle into Codex.");
      expect(output.content).toContain("## Context: AGENTS.md");
      expect(output.content).toContain("## Context: planning/dependencies.md");
      expect(output.content).toContain("## Context: docs/architecture/proposed-architecture.md");
      expect(await listWorkspaceFiles(".")).toEqual(before);
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("returns useful prepare errors for missing and blocked Work Items", async () => {
    const blockedGraph = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      nodes: {
        requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
        work_items: [
          {
            id: "wi-001",
            title: "Blocked work",
            execution_state: "backlog",
            readiness_snapshot: { graph_version: 1, labels: ["agent_eligible"], reasons: [] },
            acceptance_criteria: ["Done"],
            validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }]
          },
          {
            id: "wi-002",
            title: "Dependency work",
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
      edges: [
        { source: "wi-001", target: "req-001", type: "satisfies", rationale: "Traceability." },
        { source: "wi-002", target: "req-001", type: "satisfies", rationale: "Traceability." },
        { source: "wi-001", target: "wi-002", type: "depends_on", rationale: "Needs dependency." }
      ]
    });

    const missing = await runPlannerCli(["prepare", "wi-404", "--agent", "codex", "--dry-run", "--json"], {
      graphRepository: { load: async () => blockedGraph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined }
    });
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toBe("Work Item not found: wi-404\n");

    const blocked = await runPlannerCli(["prepare", "wi-001", "--agent", "codex", "--dry-run", "--json"], {
      graphRepository: { load: async () => blockedGraph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined }
    });
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toContain("Work Item is not agent-eligible for prepare: wi-001.");
  });

  it("reports unsupported prepare agents clearly", async () => {
    const result = await runPlannerCli(["prepare", "wi-001", "--agent", "unknown", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("Unsupported agent: unknown. Supported agents: codex, claude, gemini.\n");
  });

  it("dry-runs and applies export through filesystem adapters", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-export-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");

      const dryRun = await runPlannerCli(["export", "--dry-run", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: new FileProjectionWriter(),
        projectionReader: new FileProjectionReader()
      });

      expect(dryRun.exitCode).toBe(0);
      expect(JSON.parse(dryRun.stdout)).toMatchObject({
        dryRun: true,
        applied: false,
        created: ["planning/work-items/wi-001-work.md"]
      });
      await expect(readdir("planning/work-items")).rejects.toMatchObject({ code: "ENOENT" });

      const apply = await runPlannerCli(["export", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: new FileProjectionWriter(),
        projectionReader: new FileProjectionReader()
      });

      expect(apply.exitCode).toBe(0);
      expect(JSON.parse(apply.stdout)).toMatchObject({
        dryRun: false,
        applied: true,
        exported: ["planning/work-items/wi-001-work.md"]
      });
      expect(await readFile("planning/work-items/wi-001-work.md", "utf8")).toContain("# Work");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
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

async function listWorkspaceFiles(path: string): Promise<readonly string[]> {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort();
}
