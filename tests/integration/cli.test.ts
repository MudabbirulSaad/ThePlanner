import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runPlannerCli } from "../../src/application/index.js";
import { parsePlanningGraphJson } from "../../src/application/index.js";
import { FileWorkspaceInitializer } from "../../src/adapters/index.js";
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
