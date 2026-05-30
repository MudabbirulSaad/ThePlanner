import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPlannerCli } from "../../src/application/index.js";
import { parsePlanningGraphJson } from "../../src/application/index.js";
import { serializePlanningGraphJson } from "../../src/application/index.js";
import {
  FileAgentRunArtifactReader,
  FileAgentRunArtifactWriter,
  FileChangeLogWriter,
  FileContextReader,
  FileGraphOperationProposalReader,
  FileGraphOperationUserAnswerReader,
  FileIntakeIdeaReader,
  FilePlanningGraphRepository,
  FilePlanningGraphSchemaValidator,
  FileProjectionReader,
  FileProjectionWriter,
  FileRefinedBriefReader,
  FileRefinedBriefWriter,
  FileRepoScanner,
  GitHubDryRunTrackerSyncAdapter,
  FileWorkspaceInitializer
} from "../../src/adapters/index.js";
import { renderWorkItemProjection } from "../../src/core/index.js";
import { validatePlanningGraph } from "../../src/core/index.js";
import type { PlanningChangeLogEvent } from "../../src/application/index.js";
import type {
  AgentRunner,
  GraphOperationProposer,
  GraphOperationProposerInput,
  GraphOperationProposerResult,
  ValidationCommandRunner
} from "../../src/application/index.js";
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
        context_summary: "Complete the scoped CLI fixture Work Item.",
        boundary_notes: ["Only complete wi-001.", "Do not change unrelated files."],
        acceptance_criteria: ["Done"],
        validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }],
        safe_failure_guidance: "Stop and report uncertainty before making unrelated changes."
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

function expectJsonError(result: { readonly exitCode: number; readonly stdout: string; readonly stderr: string }, message: string): void {
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({
    status: "failed",
    error: { message }
  });
}

class CliFakeProposer implements GraphOperationProposer {
  public constructor(private readonly result: (input: GraphOperationProposerInput) => GraphOperationProposerResult) {}

  public propose(input: GraphOperationProposerInput): GraphOperationProposerResult {
    return this.result(input);
  }
}

describe("planner CLI use case wiring", () => {
  it("supports status JSON output through application use cases", async () => {
    const result = await runPlannerCli(["status", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined }
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ graphVersion: 1, status: "pass" });
  });

  it("previews GitHub tracker sync as a dry run without external writes", async () => {
    const result = await runPlannerCli(["sync", "github", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      trackerSyncAdapters: [new GitHubDryRunTrackerSyncAdapter()]
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "planned",
      tracker: "github",
      dryRun: true,
      applied: false,
      proposedIssues: [
        {
          workItemId: "wi-001",
          title: "wi-001: Work",
          labels: ["planner", "readiness:agent_eligible", "state:backlog", "work-item"],
          dependencies: [],
          references: ["req-001"]
        }
      ],
      message: "Dry run planned 1 github issue(s). No external tracker was mutated."
    });
  });

  it("rejects tracker sync without dry-run because live sync is deferred", async () => {
    const result = await runPlannerCli(["sync", "github", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      trackerSyncAdapters: [new GitHubDryRunTrackerSyncAdapter()]
    });

    expectJsonError(result, "theplanner sync requires --dry-run; live sync is deferred");
  });

  it("rejects tracker sync apply because external mutation is deferred", async () => {
    const result = await runPlannerCli(["sync", "github", "--dry-run", "--apply", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      trackerSyncAdapters: [new GitHubDryRunTrackerSyncAdapter()]
    });

    expectJsonError(result, "theplanner sync --apply is deferred; use --dry-run to preview tracker payloads");
  });

  it("returns deterministic repo scan context from a fixture without writing planning files", async () => {
    const fixtureRoot = "tests/fixtures/repo-scan/sample";
    const before = await listWorkspaceFiles(fixtureRoot);
    const graphBefore = await readFile(join(fixtureRoot, "planning/graph.json"), "utf8");

    const result = await runPlannerCli(["scan", "repo", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => { throw new Error("repo scan must not write projections"); } },
      repoScanner: new FileRepoScanner(fixtureRoot)
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      status: "scanned",
      dryRun: true,
      applied: false,
      rootPath: fixtureRoot,
      projectTypes: ["node", "theplanner", "typescript", "vite"],
      commands: [
        { name: "build", command: "tsc -p tsconfig.json", sourcePath: "package.json" },
        { name: "lint", command: "eslint .", sourcePath: "package.json" },
        { name: "test", command: "vitest run", sourcePath: "package.json" }
      ],
      relevantDocs: [
        {
          path: "docs/adr/0001-record-architecture.md",
          title: "Record Architecture",
          headings: ["Record Architecture", "Decision"]
        },
        {
          path: "README.md",
          title: "Sample Planner App",
          headings: ["Sample Planner App", "Commands", "Architecture"]
        }
      ],
      planningFiles: ["planning/graph.json", "planning/work-items/wi-001.md"],
      components: [
        { path: "src", kind: "source-area" },
        { path: "src/adapters", kind: "source-area" },
        { path: "src/core", kind: "source-area" },
        { path: "tests", kind: "test-area" },
        { path: "tests/core", kind: "test-area" }
      ],
      ignoredDirectories: [".git", ".theplanner", ".turbo", ".vite", "coverage", "dist", "node_modules", "out", "tmp"],
      scannedFiles: [
        "README.md",
        "docs/adr/0001-record-architecture.md",
        "package.json",
        "planner.config.json",
        "planning/graph.json",
        "planning/work-items/wi-001.md",
        "tsconfig.json",
        "vite.config.ts"
      ],
      message: "Dry run scanned 8 repository context file(s). No planning graph or projection files were written."
    });
    expect(await listWorkspaceFiles(fixtureRoot)).toEqual(before);
    expect(await readFile(join(fixtureRoot, "planning/graph.json"), "utf8")).toBe(graphBefore);
  });

  it("rejects repo scan without dry-run because apply is deferred", async () => {
    const result = await runPlannerCli(["scan", "repo", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      repoScanner: new FileRepoScanner("tests/fixtures/repo-scan/sample")
    });

    expectJsonError(result, "theplanner scan repo requires --dry-run");
  });

  it("returns JSON error envelopes for argument errors", async () => {
    const result = await runPlannerCli(["plan", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      refinedBriefReader: new FileRefinedBriefReader()
    });

    expectJsonError(result, "theplanner plan requires --from <file>");
  });

  it("returns JSON error envelopes for service-wiring errors", async () => {
    const result = await runPlannerCli(["init", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined }
    });

    expectJsonError(result, "theplanner init requires a workspace initializer");
  });

  it("uses configured default agent and validation command defaults", async () => {
    const graphWithoutValidation = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      nodes: {
        requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
        work_items: [
          {
            id: "wi-001",
            title: "Run Default Agent",
            execution_state: "backlog",
            readiness_snapshot: { graph_version: 1, labels: ["agent_eligible", "afk_ready"], reasons: [] },
            context_summary: "Run the configured default agent for wi-001.",
            boundary_notes: ["Only complete wi-001."],
            acceptance_criteria: ["Done"],
            validation_methods: [{ type: "manual_review", expected_result: "Safe manual validation: default configured validation command will run after the agent." }],
            safe_failure_guidance: "Stop and report uncertainty before changing unrelated files."
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
    const runner: AgentRunner = {
      run: async (input) => ({
        command: [input.agent],
        exitCode: 0,
        stdout: "",
        stderr: ""
      })
    };
    const validationInputs: string[] = [];
    const validationRunner: ValidationCommandRunner = {
      run: async (input) => {
        validationInputs.push(input.command);
        return { command: input.command, exitCode: 0, stdout: "", stderr: "" };
      }
    };

    const result = await runPlannerCli(["run", "wi-001", "--json"], {
      graphRepository: { load: async () => graphWithoutValidation },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: { writeAll: async (files) => files.map((file) => file.path) },
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      defaultAgent: "claude",
      defaultValidationCommands: ["npm run check"],
      currentTimestamp: () => "2026-05-29T12:34:56.000Z"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      agent: "claude",
      runner: { command: ["claude"], exitCode: 0 },
      validation: { commands: [{ command: "npm run check", exitCode: 0 }] }
    });
    expect(validationInputs).toEqual(["npm run check"]);
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

  it("prints actionable readiness reasons in validation output", async () => {
    const notAfkGraph = parsePlanningGraphJson({
      schema_version: "0.1.0",
      graph_version: 1,
      nodes: {
        requirements: [{ id: "req-001", title: "Requirement", type: "functional", statement: "Do it.", status: "active" }],
        work_items: [
          {
            id: "wi-001",
            title: "Needs Boundaries",
            execution_state: "backlog",
            readiness_snapshot: { graph_version: 1, labels: ["agent_eligible"], reasons: [] },
            context_summary: "Scoped context exists.",
            acceptance_criteria: ["Done"],
            validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }],
            safe_failure_guidance: "Stop and report uncertainty."
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

    const result = await runPlannerCli(["validate"], {
      graphRepository: { load: async () => notAfkGraph },
      projectionWriter: { writeAll: async () => undefined }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("readiness_reasons:");
    expect(result.stdout).toContain("wi-001: Missing boundaries/non-goals");
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

  it("reports unsupported schema versions as schema validation errors", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-schema-version-fail-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      const rawGraph = serializePlanningGraphJson(graph) as { schema_version: string };
      rawGraph.schema_version = "0.2.0";
      await writeFile("planning/graph.json", `${JSON.stringify(rawGraph, null, 2)}\n`, "utf8");

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
        semanticErrors: []
      });
      expect(output.schemaErrors.map((error: { message: string }) => error.message)).toContain(
        "$.schema_version: expected one of 0.1.0"
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
        title: "ThePlanner Graph"
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
          source: "refined-brief.md",
          product_intent: {
            summary: "Build a CLI-first ThePlanner workflow that turns a refined brief into a repository-native Planning Graph.",
            target_users: ["Solo maintainers and engineering leads planning agent-assisted software work."],
            non_goals: ["Do not call live LLM providers.", "Do not sync external trackers."],
            scaffold_notes: []
          }
        }
      });
      expect(validatePlanningGraph(parsePlanningGraphJson(output.graph)).status).toBe("pass");
      expect(output.graph.nodes.work_items).toHaveLength(3);
      expect(output.graph.nodes.document_projections).toHaveLength(4);
      expect(output.graph.nodes.document_projections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "doc-003",
            path: "docs/rfc/proposed-decisions.md",
            projection_type: "rfc"
          })
        ])
      );
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
          source: "planning/intake/refined-brief.md",
          product_intent: {
            summary: "Build a CLI-first ThePlanner workflow that turns a refined brief into a repository-native Planning Graph.",
            success_criteria: ["The dry run prints deterministic JSON and does not mutate repository files."],
            scaffold_notes: []
          }
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
      expect(savedGraph.productIntent?.nonGoals).toEqual(["Do not call live LLM providers.", "Do not sync external trackers."]);

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

      expectJsonError(result, "Refusing to overwrite existing non-empty planning/graph.json without an explicit force/update path.");
      expect(parsePlanningGraphJson(JSON.parse(await readFile("planning/graph.json", "utf8"))).nodes).toHaveLength(graph.nodes.length);
      expect(await readFile("planning/change-log.ndjson", "utf8")).toBe("");
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("dry-runs an AddOpenQuestion Graph Operation fixture without writing graph files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-operation-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await new FilePlanningGraphRepository().save(graph);
      await writeFile(
        "proposal.json",
        `${JSON.stringify(
          {
            operation: "add_open_question",
            open_question: {
              id: "oq-001",
              title: "Deployment target",
              question: "Which deployment target should the first release support?",
              priority: "high",
              blocks_execution: true,
              provenance: {
                source_type: "planner_inference",
                source_reference: "planning/intake/refined-brief.md#open-questions",
                created_by: "test proposer",
                confidence: "medium"
              }
            }
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      const before = await readFile("planning/graph.json", "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--dry-run", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => { throw new Error("graph operation dry-run must not write projections"); } },
        graphOperationProposalReader: new FileGraphOperationProposalReader()
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "candidate",
        dryRun: true,
        applied: false,
        operation: "AddOpenQuestion",
        graphVersionBefore: 1,
        graphVersionAfter: 2,
        candidateGraph: {
          graph_version: 2,
          nodes: {
            open_questions: [
              {
                id: "oq-001",
                title: "Deployment target",
                question: "Which deployment target should the first release support?",
                priority: "high",
                blocks_execution: true
              }
            ]
          }
        },
        validation: { status: "pass" }
      });
      expect(await readFile("planning/graph.json", "utf8")).toBe(before);
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
      expectJsonError(missing, "Refined brief file not found: missing.md");

      await writeFile("empty.md", "\n", "utf8");
      const empty = await runPlannerCli(["plan", "--from", "empty.md", "--dry-run", "--json"], {
        graphRepository: { load: async () => graph },
        projectionWriter: { writeAll: async () => undefined },
        refinedBriefReader: new FileRefinedBriefReader()
      });
      expectJsonError(empty, "Refined brief is empty: empty.md");
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
            context_summary: "Prepare a scoped Work Item with generated document context.",
            boundary_notes: ["Use generated context only for wi-001."],
            acceptance_criteria: ["Done"],
            validation_methods: [{ type: "command", command: "npm test", expected_result: "Pass" }],
            safe_failure_guidance: "Stop and report missing context before making changes."
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
        runId: null,
        bundlePath: null,
        artifactPaths: [],
        createdPaths: [],
        metadata: null,
        validationCommands: ["npm test"],
        context: [
          { path: "AGENTS.md", source: "workspace" },
          { path: "planning/work-items/wi-001-work.md", source: "generated" },
          { path: "planning/execution-context/wi-001.md", source: "generated" },
          { path: "planning/dependencies.md", source: "generated" }
        ]
      });
      expect(output.content).toContain("# Agent Context Bundle");
      expect(output.content).toContain("Paste this full bundle into Codex.");
      expect(output.content).toContain("## Context: AGENTS.md");
      expect(output.content).toContain("## Context: planning/execution-context/wi-001.md");
      expect(output.content).toContain("## Context: planning/dependencies.md");
      expect(output.content).not.toContain("## Context: docs/architecture/proposed-architecture.md");
      expect(await listWorkspaceFiles(".")).toEqual(before);
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("writes deterministic prepare run artifacts in apply mode without executing agents", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-prepare-apply-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("AGENTS.md", "# Repo Instructions\n\nStay in scope.\n", "utf8");
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");

      const result = await runPlannerCli(["prepare", "wi-001", "--agent", "codex", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => { throw new Error("prepare apply must not write projections"); } },
        contextFileReader: new FileContextReader(),
        runArtifactWriter: new FileAgentRunArtifactWriter(),
        currentTimestamp: () => "2026-05-29T12:34:56.000Z"
      });

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        status: "prepared",
        dryRun: false,
        applied: true,
        agent: "codex",
        workItemId: "wi-001",
        runId: "run-20260529-123456-wi-001",
        bundlePath: "planning/runs/run-20260529-123456-wi-001/prompt.md",
        artifactPaths: [
          "planning/runs/run-20260529-123456-wi-001/metadata.json",
          "planning/runs/run-20260529-123456-wi-001/prompt.md",
          "planning/runs/run-20260529-123456-wi-001/context.md"
        ],
        createdPaths: [
          "planning/runs/run-20260529-123456-wi-001/metadata.json",
          "planning/runs/run-20260529-123456-wi-001/prompt.md",
          "planning/runs/run-20260529-123456-wi-001/context.md"
        ],
        metadata: {
          runId: "run-20260529-123456-wi-001",
          workItemId: "wi-001",
          graphVersion: 1,
          agent: "codex",
          generatedAt: "2026-05-29T12:34:56.000Z",
          validationCommands: ["npm test"]
        }
      });

      const metadata = JSON.parse(await readFile("planning/runs/run-20260529-123456-wi-001/metadata.json", "utf8"));
      expect(metadata).toEqual(output.metadata);
      await expect(readFile("planning/runs/run-20260529-123456-wi-001/prompt.md", "utf8")).resolves.toContain(
        "# Agent Context Bundle"
      );
      await expect(readFile("planning/runs/run-20260529-123456-wi-001/context.md", "utf8")).resolves.toContain(
        "## AGENTS.md"
      );
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
    expectJsonError(missing, "Work Item not found: wi-404");

    const blocked = await runPlannerCli(["prepare", "wi-001", "--agent", "codex", "--dry-run", "--json"], {
      graphRepository: { load: async () => blockedGraph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined }
    });
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toBe("");
    expect(JSON.parse(blocked.stdout).error.message).toContain("Work Item is not agent-eligible for prepare: wi-001.");
  });

  it("reports unsupported prepare agents clearly", async () => {
    const result = await runPlannerCli(["prepare", "wi-001", "--agent", "unknown", "--dry-run", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined }
    });

    expectJsonError(result, "Unsupported agent: unknown. Supported agents: codex, claude, gemini.");
  });

  it("runs a ready Work Item through a fake Codex runner from the CLI", async () => {
    const runner: AgentRunner = {
      run: async (input) => ({
        command: ["codex"],
        exitCode: 0,
        stdout: `ran ${input.workItemId}\n`,
        stderr: ""
      })
    };
    const validationRunner: ValidationCommandRunner = {
      run: async (input) => ({
        command: input.command,
        exitCode: 0,
        stdout: "validation ok\n",
        stderr: ""
      })
    };

    const result = await runPlannerCli(["run", "wi-001", "--agent", "codex", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: { writeAll: async (files) => files.map((file) => file.path) },
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      currentTimestamp: () => "2026-05-29T12:34:56.000Z"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "completed",
      agent: "codex",
      workItemId: "wi-001",
      runId: "run-20260529-123456-wi-001",
      runner: {
        command: ["codex"],
        exitCode: 0
      },
      validation: {
        status: "pass",
        commands: [{ command: "npm test", exitCode: 0 }]
      },
      artifactPaths: [
        "planning/runs/run-20260529-123456-wi-001/metadata.json",
        "planning/runs/run-20260529-123456-wi-001/prompt.md",
        "planning/runs/run-20260529-123456-wi-001/context.md",
        "planning/runs/run-20260529-123456-wi-001/runner-stdout.log",
        "planning/runs/run-20260529-123456-wi-001/runner-stderr.log",
        "planning/runs/run-20260529-123456-wi-001/validation-stdout.log",
        "planning/runs/run-20260529-123456-wi-001/validation-stderr.log",
        "planning/runs/run-20260529-123456-wi-001/result.json"
      ]
    });
  });

  it.each(["claude", "gemini"] as const)("runs a ready Work Item through a fake %s runner from the CLI", async (agent) => {
    const runner: AgentRunner = {
      run: async (input) => ({
        command: [input.agent],
        exitCode: 0,
        stdout: `ran ${input.agent} ${input.workItemId}\n`,
        stderr: ""
      })
    };
    const validationRunner: ValidationCommandRunner = {
      run: async (input) => ({
        command: input.command,
        exitCode: 0,
        stdout: "validation ok\n",
        stderr: ""
      })
    };

    const result = await runPlannerCli(["run", "wi-001", "--agent", agent, "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: { writeAll: async (files) => files.map((file) => file.path) },
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      currentTimestamp: () => "2026-05-29T12:34:56.000Z"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "completed",
      agent,
      workItemId: "wi-001",
      runner: {
        command: [agent],
        exitCode: 0
      }
    });
  });

  it("returns useful JSON when the Codex runner is missing", async () => {
    const runner: AgentRunner = {
      run: async () => ({
        command: ["codex"],
        exitCode: 127,
        stdout: "",
        stderr: "",
        error: {
          code: "runner_not_found",
          message: "Codex runner command not found: codex"
        }
      })
    };
    const validationRunner: ValidationCommandRunner = {
      run: async (input) => ({
        command: input.command,
        exitCode: 0,
        stdout: "",
        stderr: ""
      })
    };

    const result = await runPlannerCli(["run", "wi-001", "--agent", "codex", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: { writeAll: async (files) => files.map((file) => file.path) },
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      currentTimestamp: () => "2026-05-29T12:34:56.000Z"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "failed",
      runner: {
        exitCode: 127,
        error: {
          code: "runner_not_found",
          message: "Codex runner command not found: codex"
        }
      },
      validation: {
        status: "pass"
      }
    });
  });

  it("returns non-zero JSON when post-agent validation fails", async () => {
    const runner: AgentRunner = {
      run: async () => ({
        command: ["codex"],
        exitCode: 0,
        stdout: "agent ok\n",
        stderr: ""
      })
    };
    const validationRunner: ValidationCommandRunner = {
      run: async (input) => ({
        command: input.command,
        exitCode: 1,
        stdout: "validation failed\n",
        stderr: "test failure\n"
      })
    };

    const result = await runPlannerCli(["run", "wi-001", "--agent", "codex", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      contextFileReader: { readIfExists: async () => undefined },
      runArtifactWriter: { writeAll: async (files) => files.map((file) => file.path) },
      agentRunner: runner,
      validationCommandRunner: validationRunner,
      currentTimestamp: () => "2026-05-29T12:34:56.000Z"
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "failed",
      runner: { exitCode: 0 },
      validation: {
        status: "fail",
        commands: [{ command: "npm test", exitCode: 1 }]
      }
    });
  });

  it("reviews and accepts a saved agent run from the CLI", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-run-review-"));

    try {
      process.chdir(workspace);
      await mkdir("planning/runs/run-20260529-123456-wi-001", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile(
        "planning/runs/run-20260529-123456-wi-001/metadata.json",
        `${JSON.stringify(
          {
            runId: "run-20260529-123456-wi-001",
            workItemId: "wi-001",
            graphVersion: 1,
            agent: "codex",
            generatedAt: "2026-05-29T12:34:56.000Z",
            validationCommands: ["npm test"],
            validation: { status: "pass", commands: [{ command: "npm test", exitCode: 0 }] }
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await writeFile(
        "planning/runs/run-20260529-123456-wi-001/result.json",
        `${JSON.stringify(
          {
            status: "completed",
            runId: "run-20260529-123456-wi-001",
            runner: { command: ["codex"], exitCode: 0 },
            artifactPaths: [
              "planning/runs/run-20260529-123456-wi-001/metadata.json",
              "planning/runs/run-20260529-123456-wi-001/result.json"
            ]
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const services = {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        runArtifactReader: new FileAgentRunArtifactReader(),
        changeLogWriter: new FileChangeLogWriter(),
        currentTimestamp: () => "2026-05-29T13:00:00.000Z"
      };
      const review = await runPlannerCli(["run", "review", "run-20260529-123456-wi-001", "--json"], services);
      const accept = await runPlannerCli(["run", "accept", "run-20260529-123456-wi-001", "--json"], services);

      expect(review.exitCode).toBe(0);
      expect(JSON.parse(review.stdout)).toMatchObject({
        status: "ready_for_review",
        runId: "run-20260529-123456-wi-001",
        workItem: { id: "wi-001", title: "Work" },
        runner: { exitCode: 0 },
        validation: { status: "pass" }
      });
      expect(accept.exitCode).toBe(0);
      expect(JSON.parse(accept.stdout)).toMatchObject({
        status: "accepted",
        runId: "run-20260529-123456-wi-001",
        workItemId: "wi-001"
      });
      const events = (await readFile("planning/change-log.ndjson", "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      expect(events).toMatchObject([{ operation_type: "agent_run_accepted", approval_status: "accepted" }]);
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects invalid run ids from run review JSON", async () => {
    const result = await runPlannerCli(["run", "review", "../bad", "--json"], {
      graphRepository: { load: async () => graph },
      projectionWriter: { writeAll: async () => undefined },
      runArtifactReader: new FileAgentRunArtifactReader()
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      status: "failed",
      error: { message: "Invalid run id: ../bad" }
    });
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

  it("refuses unsafe projection paths during filesystem export", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-export-unsafe-"));
    const rawGraph = serializePlanningGraphJson(graph) as {
      nodes: {
        document_projections: {
          id: string;
          title: string;
          path: string;
          projection_type: string;
        }[];
      };
    };
    rawGraph.nodes.document_projections.push({
      id: "doc-001",
      title: "Unsafe projection",
      path: "../outside.md",
      projection_type: "dependency_view"
    });

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(rawGraph, null, 2)}\n`, "utf8");

      const result = await runPlannerCli(["export", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: new FileProjectionWriter(),
        projectionReader: new FileProjectionReader()
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("");
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "failed",
        error: {
          message: "Projection path must be a safe relative path within the workspace: ../outside.md"
        }
      });
      await expect(readFile("../outside.md", "utf8")).rejects.toMatchObject({ code: "ENOENT" });
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

  it("dry-runs Graph Operation proposals without writing planning files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-op-dry-run-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile("proposal.json", `${JSON.stringify(addOpenQuestionProposal(), null, 2)}\n`, "utf8");
      const graphBefore = await readFile("planning/graph.json", "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--dry-run", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        graphOperationProposalReader: new FileGraphOperationProposalReader(),
        changeLogWriter: new FileChangeLogWriter()
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "candidate",
        dryRun: true,
        applied: false,
        operation: "AddOpenQuestion",
        graphVersionBefore: 1,
        graphVersionAfter: 2,
        affectedNodeIds: ["oq-001"],
        validation: { status: "pass" }
      });
      expect(await readFile("planning/graph.json", "utf8")).toBe(graphBefore);
      await expect(readFile("planning/change-log.ndjson", "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("dry-runs intake grilling proposals in JSON and human-readable output without writing planning files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-grill-dry-run-"));
    const proposer = new CliFakeProposer((input) => ({
      proposals: [
        {
          sourceReference: input.userAnswers?.[0]?.sourceReference ?? `${input.intakeBrief?.sourcePath}#audience`,
          operation: input.userAnswers
            ? {
                operation: "add_decision",
                decision: {
                  id: "dec-001",
                  title: "Primary audience",
                  status: "accepted",
                  selected_option: input.userAnswers[0]?.answer ?? "Maintainers",
                  rationale: "The answer supplies the missing audience commitment.",
                  rejected_alternatives: [],
                  unresolved_questions: [],
                  provenance: {
                    source_type: "user_answer",
                    source_reference: input.userAnswers[0]?.sourceReference,
                    created_by: "cli fake proposer",
                    confidence: "high"
                  }
                },
                approval_classification: {
                  category: "commitment_changing",
                  rationale: "Accepted Decisions from grilling answers change planning commitments."
                }
              }
            : {
                operation: "add_open_question",
                open_question: {
                  id: "oq-001",
                  title: "Primary audience",
                  question: "Who is the primary audience for the first release?",
                  priority: "high",
                  blocks_execution: true,
                  provenance: {
                    source_type: "planner_inference",
                    source_reference: `${input.intakeBrief?.sourcePath}#audience`,
                    created_by: "cli fake proposer",
                    confidence: "medium"
                  }
                }
              }
        }
      ]
    }));

    try {
      process.chdir(workspace);
      await mkdir("planning/intake", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile("planning/intake/refined-brief.md", "# Intake Brief\n\nAudience is unclear.\n", "utf8");
      await writeFile(
        "planning/intake/answers.json",
        `${JSON.stringify({ answers: [{ question_id: "oq-001", answer: "Maintainers preparing AFK-ready Work Items." }] }, null, 2)}\n`,
        "utf8"
      );
      const graphBefore = await readFile("planning/graph.json", "utf8");

      const jsonResult = await runPlannerCli(
        ["intake", "grill", "--from", "planning/intake/refined-brief.md", "--dry-run", "--json"],
        {
          graphRepository: new FilePlanningGraphRepository(),
          projectionWriter: new FileProjectionWriter(),
          refinedBriefReader: new FileRefinedBriefReader(),
          graphOperationProposer: proposer,
          graphOperationUserAnswerReader: new FileGraphOperationUserAnswerReader()
        }
      );

      expect(jsonResult.exitCode).toBe(0);
      expect(JSON.parse(jsonResult.stdout)).toMatchObject({
        status: "candidate",
        dryRun: true,
        applied: false,
        proposedOpenQuestions: [
          {
            id: "oq-001",
            question: "Who is the primary audience for the first release?"
          }
        ]
      });

      const answerResult = await runPlannerCli(
        [
          "intake",
          "grill",
          "--from",
          "planning/intake/refined-brief.md",
          "--answers",
          "planning/intake/answers.json",
          "--dry-run"
        ],
        {
          graphRepository: new FilePlanningGraphRepository(),
          projectionWriter: new FileProjectionWriter(),
          refinedBriefReader: new FileRefinedBriefReader(),
          graphOperationProposer: proposer,
          graphOperationUserAnswerReader: new FileGraphOperationUserAnswerReader()
        }
      );

      expect(answerResult.exitCode).toBe(0);
      expect(answerResult.stdout).toContain("grilling_session: dry-run");
      expect(answerResult.stdout).toContain("AddDecision: approval_required=true category=commitment_changing");
      expect(await readFile("planning/graph.json", "utf8")).toBe(graphBefore);
      await expect(readFile("planning/change-log.ndjson", "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readdir("planning/work-items")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("applies valid Graph Operation proposals and appends a change-log event", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-op-apply-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile("proposal.json", `${JSON.stringify(addOpenQuestionProposal(), null, 2)}\n`, "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        graphOperationProposalReader: new FileGraphOperationProposalReader(),
        changeLogWriter: new FileChangeLogWriter(),
        currentTimestamp: () => "2026-05-31T01:02:03.000Z"
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "applied",
        dryRun: false,
        applied: true,
        operation: "AddOpenQuestion",
        approvalStatus: "not_required",
        affectedNodeIds: ["oq-001"],
        event: {
          event_id: "evt-20260531010203-2",
          graph_version_before: 1,
          graph_version_after: 2,
          operation_type: "AddOpenQuestion",
          affected_node_ids: ["oq-001"],
          approval_status: "not_required",
          provenance_reference: "theplanner graph-operation --from proposal.json --apply"
        }
      });
      expect(JSON.parse(await readFile("planning/graph.json", "utf8"))).toMatchObject({
        graph_version: 2,
        nodes: { open_questions: [{ id: "oq-001" }] }
      });
      expect(JSON.parse((await readFile("planning/change-log.ndjson", "utf8")).trim())).toMatchObject({
        operation_type: "AddOpenQuestion",
        affected_node_ids: ["oq-001"]
      });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects invalid Graph Operation apply without mutating files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-op-invalid-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile(
        "proposal.json",
        `${JSON.stringify({ ...addOpenQuestionProposal(), open_question: { ...addOpenQuestionProposal().open_question, id: "wi-001" } }, null, 2)}\n`,
        "utf8"
      );
      const graphBefore = await readFile("planning/graph.json", "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        graphOperationProposalReader: new FileGraphOperationProposalReader(),
        changeLogWriter: new FileChangeLogWriter()
      });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "rejected",
        applied: false,
        operationErrors: expect.arrayContaining([
          expect.objectContaining({ code: "open_question_id_invalid", nodeId: "wi-001" })
        ])
      });
      expect(await readFile("planning/graph.json", "utf8")).toBe(graphBefore);
      await expect(readFile("planning/change-log.ndjson", "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("refuses approval-required Graph Operation apply without explicit approval", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-op-approval-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile("proposal.json", `${JSON.stringify(acceptedDecisionProposal(), null, 2)}\n`, "utf8");
      const graphBefore = await readFile("planning/graph.json", "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--apply", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        graphOperationProposalReader: new FileGraphOperationProposalReader(),
        changeLogWriter: new FileChangeLogWriter()
      });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "rejected",
        applied: false,
        approvalRequired: true,
        approvalStatus: "missing",
        operationErrors: [{ code: "graph_operation_approval_required" }]
      });
      expect(await readFile("planning/graph.json", "utf8")).toBe(graphBefore);
      await expect(readFile("planning/change-log.ndjson", "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("applies approval-required Graph Operation proposals with a strict approval flag", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(join(tmpdir(), "planner-graph-op-approved-"));

    try {
      process.chdir(workspace);
      await mkdir("planning", { recursive: true });
      await writeFile("planning/graph.json", `${JSON.stringify(serializePlanningGraphJson(graph), null, 2)}\n`, "utf8");
      await writeFile("proposal.json", `${JSON.stringify(acceptedDecisionProposal(), null, 2)}\n`, "utf8");

      const result = await runPlannerCli(["graph-operation", "--from", "proposal.json", "--apply", "--approved", "--json"], {
        graphRepository: new FilePlanningGraphRepository(),
        projectionWriter: { writeAll: async () => undefined },
        graphOperationProposalReader: new FileGraphOperationProposalReader(),
        changeLogWriter: new FileChangeLogWriter(),
        currentTimestamp: () => "2026-05-31T04:05:06.000Z"
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: "applied",
        applied: true,
        approvalRequired: true,
        approvalStatus: "approved",
        affectedNodeIds: ["dec-001"],
        event: {
          graph_version_before: 1,
          graph_version_after: 2,
          operation_type: "AddDecision",
          affected_node_ids: ["dec-001"],
          approval_status: "approved"
        }
      });
      expect(JSON.parse(await readFile("planning/graph.json", "utf8"))).toMatchObject({
        graph_version: 2,
        nodes: { decisions: [{ id: "dec-001", status: "accepted" }] }
      });
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { force: true, recursive: true });
    }
  });
});

async function listWorkspaceFiles(path: string): Promise<readonly string[]> {
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort();
}

function addOpenQuestionProposal() {
  return {
    operation: "add_open_question",
    open_question: {
      id: "oq-001",
      title: "Deployment target",
      question: "Which deployment target should the first release support?",
      priority: "high",
      blocks_execution: true,
      provenance: {
        source_type: "planner_inference",
        source_reference: "proposal.json",
        created_by: "test proposer",
        confidence: "medium"
      }
    }
  };
}

function acceptedDecisionProposal() {
  return {
    operation: "add_decision",
    approval_classification: {
      category: "commitment_changing",
      rationale: "Accepted decisions change planning commitments."
    },
    decision: {
      id: "dec-001",
      title: "Use markdown projections",
      status: "accepted",
      selected_option: "Use Markdown files as projections over the Planning Graph.",
      rationale: "Projection files are reviewable while the graph remains canonical.",
      rejected_alternatives: ["Provider-written graph files"],
      unresolved_questions: [],
      provenance: {
        source_type: "user_answer",
        source_reference: "proposal.json",
        created_by: "test proposer",
        confidence: "high"
      }
    }
  };
}
