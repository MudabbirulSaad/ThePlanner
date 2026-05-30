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

function afkCandidateRaw() {
  const raw = cloneGraph();
  const workItem = raw.nodes.work_items.find((node: { id: string }) => node.id === "wi-006");
  workItem.execution_state = "backlog";
  workItem.readiness_snapshot.labels = ["agent_eligible"];
  workItem.context_summary = "Reconcile edited Work Item projections back to safe graph patches.";
  workItem.boundary_notes = ["Only implement reconciliation behavior for projection edits.", "Do not change agent execution semantics."];
  workItem.safe_failure_guidance = "Stop and report a conflict when an edit cannot be mapped to a safe graph patch.";
  return { raw, workItem };
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

  it("marks a Work Item AFK-ready only when deep readiness checks pass", () => {
    const { raw } = afkCandidateRaw();

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("pass");
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "afk_ready"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toEqual([
      "Context, boundaries, validation, dependency closure, and safe-failure guidance are AFK-ready."
    ]);
  });

  it("blocks AFK readiness when context is missing", () => {
    const { raw, workItem } = afkCandidateRaw();
    delete workItem.context_summary;
    raw.edges = raw.edges.filter((edge: { source: string; type: string }) => edge.source !== "wi-006" || edge.type !== "satisfies");

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "blocked"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toContain(
      "Missing context: add a context_summary or trace the Work Item to a Requirement or accepted Decision."
    );
  });

  it("blocks AFK readiness when boundaries are missing", () => {
    const { raw, workItem } = afkCandidateRaw();
    workItem.boundary_notes = [];

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("pass");
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "blocked"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toEqual([
      "Missing boundaries/non-goals: add boundary_notes that constrain autonomous implementation."
    ]);
  });

  it("blocks AFK readiness when validation is not executable or safely manual", () => {
    const { raw, workItem } = afkCandidateRaw();
    workItem.validation_methods = [{ type: "manual_review", expected_result: "Reviewer checks the result." }];

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("pass");
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "blocked"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toEqual([
      "Missing executable or safe manual validation: add a command/test validation method with a command, or document safe manual validation."
    ]);
  });

  it("blocks AFK readiness when safe-failure guidance is missing", () => {
    const { raw, workItem } = afkCandidateRaw();
    delete workItem.safe_failure_guidance;

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("pass");
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "blocked"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toEqual([
      "Missing safe-failure guidance: add safe_failure_guidance that tells the agent how to stop or report uncertainty."
    ]);
  });

  it("rejects unsupported Planning Graph schema versions", () => {
    const raw = cloneGraph();
    raw.schema_version = "0.2.0";

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("error");
    expect(result.semanticErrors).toContainEqual(
      expect.objectContaining({
        code: "unsupported_schema_version",
        message: expect.stringContaining('Unsupported Planning Graph schema_version "0.2.0"')
      })
    );
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

  it("keeps Work Items depending on proposed or revisit Decisions out of AFK readiness", () => {
    const raw = cloneGraph();
    const workItem = raw.nodes.work_items.find((node: { id: string }) => node.id === "wi-006");
    workItem.execution_state = "backlog";
    workItem.readiness_snapshot.labels = ["agent_eligible"];
    workItem.context_summary = "Reconcile edited projections.";
    workItem.boundary_notes = ["Only test decision dependency blocking."];
    workItem.safe_failure_guidance = "Stop and report unresolved decisions.";
    raw.nodes.decisions[0].status = "proposed";
    raw.nodes.decisions[1].status = "revisit";
    raw.edges.push(
      {
        source: "wi-006",
        target: "dec-001",
        type: "depends_on",
        rationale: "Proposed decision blocks AFK execution."
      },
      {
        source: "wi-006",
        target: "dec-002",
        type: "depends_on",
        rationale: "Revisit decision blocks AFK execution."
      }
    );

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));

    expect(result.status).toBe("pass");
    expect(result.readinessSnapshots["wi-006"]?.labels).toEqual(["agent_eligible", "blocked"]);
    expect(result.readinessSnapshots["wi-006"]?.reasons).toEqual([
      "Depends on unresolved Decision dec-001.",
      "Depends on unresolved Decision dec-002."
    ]);
    expect(result.readinessSummary.afkReady).not.toContain("wi-006");
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

  it("requires active HITL Gates to include a required action, blocked Work Items, and a cause link", () => {
    const raw = cloneGraph();
    raw.nodes.hitl_gates[0].status = "active";
    raw.nodes.hitl_gates[0].required_action = "";
    raw.nodes.hitl_gates[0].blocks = [];

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));
    const codes = result.semanticErrors.map((error) => error.code);

    expect(codes).toContain("hitl_gate_missing_required_action");
    expect(codes).toContain("hitl_gate_missing_blocked_work_items");
    expect(codes).toContain("hitl_gate_missing_cause_link");
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

  it("rejects malformed component relationships and interfaces", () => {
    const raw = cloneGraph();
    raw.nodes.components[0].interfaces = [
      { name: "", direction: "sideways", contract: "" }
    ];
    raw.nodes.components[0].depends_on = ["comp-001", "comp-missing"];
    raw.edges.push({
      source: "req-001",
      target: "comp-001",
      type: "references",
      rationale: "Requirement should not directly reference a component."
    });

    const result = validatePlanningGraph(parsePlanningGraphJson(raw));
    const codes = result.semanticErrors.map((error) => error.code);

    expect(codes).toContain("component_interface_missing_contract");
    expect(codes).toContain("component_interface_invalid_direction");
    expect(codes).toContain("component_self_dependency");
    expect(codes).toContain("component_dependency_missing");
    expect(codes).toContain("component_reference_invalid_source");
  });
});
