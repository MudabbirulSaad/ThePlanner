import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parsePlanningGraphJson } from "../../src/application/index.js";
import { validatePlanningGraph } from "../../src/core/index.js";

function loadGraph() {
  return parsePlanningGraphJson(
    JSON.parse(readFileSync("examples/ai-engineering-planner-v1/planning/graph.json", "utf8"))
  );
}

function cloneGraph() {
  return JSON.parse(readFileSync("examples/ai-engineering-planner-v1/planning/graph.json", "utf8"));
}

describe("graph validation and readiness", () => {
  it("validates the clean starter workspace graph", () => {
    const graph = parsePlanningGraphJson(JSON.parse(readFileSync("planning/graph.json", "utf8")));
    const result = validatePlanningGraph(graph);

    expect(result.status).toBe("pass");
    expect(result.graphVersion).toBe(1);
    expect(result.readinessSummary).toEqual({
      afkReady: [],
      agentEligible: [],
      blocked: [],
      hitlGated: [],
      humanOnly: []
    });
  });

  it("validates the canonical planning graph and derives readiness", () => {
    const result = validatePlanningGraph(loadGraph());

    expect(result.status).toBe("pass");
    expect(result.graphVersion).toBe(6);
    expect(result.schemaStatus).toBe("not_run");
    expect(result.readinessSnapshots["wi-003"]?.labels).toEqual(["agent_eligible", "afk_ready"]);
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "afk_ready"]);
  });

  it("requires Work Item traceability and Acceptance Criteria", () => {
    const raw = cloneGraph();
    raw.nodes.work_items[0].acceptance_criteria = [];
    raw.edges = raw.edges.filter((edge: { source: string; type: string }) => edge.source !== "wi-001" || edge.type !== "satisfies");

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.semanticErrors.map((error) => error.code)).toContain("work_item_missing_traceability");
    expect(result.semanticErrors.map((error) => error.code)).toContain("work_item_missing_acceptance_criteria");
  });

  it("rejects AFK readiness when HITL or unresolved Decision blockers remain", () => {
    const raw = cloneGraph();
    const workItem = raw.nodes.work_items.find((node: { id: string }) => node.id === "wi-006");
    workItem.execution_state = "backlog";
    raw.nodes.hitl_gates[0].status = "active";
    raw.nodes.hitl_gates[0].blocks = ["wi-006"];
    raw.nodes.decisions[0].status = "proposed";
    raw.edges.push({
      source: "wi-006",
      target: "dec-001",
      type: "depends_on",
      rationale: "Proposed decision blocks AFK execution."
    });

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual([
      "agent_eligible",
      "hitl_gated",
      "blocked"
    ]);
    expect(result.semanticErrors.map((error) => error.code)).toContain("invalid_afk_readiness");
  });

  it("detects missing edge references, blocker causes, and Work Item cycles", () => {
    const raw = cloneGraph();
    raw.edges.push(
      { source: "wi-003", target: "wi-missing", type: "depends_on", rationale: "Missing target." },
      { source: "wi-003", target: "wi-004", type: "depends_on", rationale: "Cycle part one." },
      { source: "wi-004", target: "wi-003", type: "depends_on", rationale: "Cycle part two." },
      { source: "hitl-001", target: "wi-003", type: "blocks", rationale: "" }
    );

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));
    const codes = result.semanticErrors.map((error) => error.code);

    expect(codes).toContain("edge_target_missing");
    expect(codes).toContain("blocker_missing_cause");
    expect(codes).toContain("work_item_dependency_cycle");
  });

  it("rejects Document Projection paths outside the workspace", () => {
    const raw = cloneGraph();
    raw.nodes.document_projections[0].path = "../outside.md";

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.semanticErrors).toContainEqual(
      expect.objectContaining({
        code: "document_projection_unsafe_path",
        nodeId: raw.nodes.document_projections[0].id
      })
    );
  });
});
