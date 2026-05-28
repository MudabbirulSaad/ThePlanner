import type {
  DependencyEdge,
  DocumentProjectionNode,
  HitlGateNode,
  PlanningGraph,
  PlanningNode,
  PlanningNodeId,
  ReadinessLabel,
  ReadinessSnapshot,
  WorkItemId,
  WorkItemNode
} from "./graph.js";

export type ValidationStatus = "pass" | "warning" | "error";
export type SchemaValidationStatus = "not_run" | "pass" | "warning" | "error";

export interface ValidationFinding {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: PlanningNodeId;
  readonly edge?: DependencyEdge;
}

export interface ReadinessSummary {
  readonly afkReady: readonly WorkItemId[];
  readonly agentEligible: readonly WorkItemId[];
  readonly blocked: readonly WorkItemId[];
  readonly hitlGated: readonly WorkItemId[];
  readonly humanOnly: readonly WorkItemId[];
}

export interface GraphValidationResult {
  readonly graphVersion: number;
  readonly status: ValidationStatus;
  readonly schemaStatus: SchemaValidationStatus;
  readonly semanticErrors: readonly ValidationFinding[];
  readonly semanticWarnings: readonly ValidationFinding[];
  readonly readinessSummary: ReadinessSummary;
  readonly readinessSnapshots: Readonly<Record<string, ReadinessSnapshot>>;
}

export function validatePlanningGraph(graph: PlanningGraph): GraphValidationResult {
  const nodeById = new Map<string, PlanningNode>(graph.nodes.map((node) => [node.id, node]));
  const workItems = graph.nodes.filter(isWorkItem);
  const semanticErrors: ValidationFinding[] = [];
  const semanticWarnings: ValidationFinding[] = [];

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source)) {
      semanticErrors.push({
        code: "edge_source_missing",
        message: `Dependency edge source does not exist: ${edge.source}`,
        edge
      });
    }

    if (!nodeById.has(edge.target)) {
      semanticErrors.push({
        code: "edge_target_missing",
        message: `Dependency edge target does not exist: ${edge.target}`,
        edge
      });
    }
  }

  for (const workItem of workItems) {
    const traceEdges = graph.edges.filter(
      (edge) =>
        edge.source === workItem.id &&
        ["satisfies", "references"].includes(edge.type) &&
        isRequirementOrAcceptedDecision(nodeById.get(edge.target))
    );

    if (traceEdges.length === 0) {
      semanticErrors.push({
        code: "work_item_missing_traceability",
        message: `Work Item must trace to at least one Requirement or accepted Decision: ${workItem.id}`,
        nodeId: workItem.id
      });
    }

    if (workItem.acceptanceCriteria.length === 0) {
      semanticErrors.push({
        code: "work_item_missing_acceptance_criteria",
        message: `Work Item must have Acceptance Criteria: ${workItem.id}`,
        nodeId: workItem.id
      });
    }
  }

  for (const document of graph.nodes.filter(isDocumentProjection)) {
    if (!document.path || !document.projectionType) {
      semanticErrors.push({
        code: "document_projection_missing_metadata",
        message: `Document Projection must include path and projection type: ${document.id}`,
        nodeId: document.id
      });
    }
  }

  const cycles = detectWorkItemCycles(graph, nodeById);
  for (const cycle of cycles) {
    semanticErrors.push({
      code: "work_item_dependency_cycle",
      message: `Work Item dependency cycle detected: ${cycle.join(" -> ")}`,
      nodeId: cycle[0] as WorkItemId
    });
  }

  for (const edge of graph.edges.filter((candidate) => candidate.type === "blocks")) {
    if (!edge.rationale.trim()) {
      semanticErrors.push({
        code: "blocker_missing_cause",
        message: `Blocker edge must explain its cause: ${edge.source} blocks ${edge.target}`,
        edge
      });
    }
  }

  const readinessSnapshots = Object.fromEntries(
    workItems.map((workItem) => [
      workItem.id,
      deriveReadinessSnapshot(graph, workItem, nodeById, semanticErrors)
    ])
  );

  for (const workItem of workItems) {
    const snapshot = readinessSnapshots[workItem.id];
    if (
      workItem.readinessSnapshot.labels.includes("afk_ready") &&
      !snapshot.labels.includes("afk_ready")
    ) {
      semanticErrors.push({
        code: "invalid_afk_readiness",
        message: `Stored AFK-ready label is not supported by deterministic validation: ${workItem.id}`,
        nodeId: workItem.id
      });
    }

    if (!snapshot.labels.includes("afk_ready")) {
      continue;
    }

    if (workItem.validationMethods.length === 0) {
      semanticErrors.push({
        code: "afk_work_item_missing_validation",
        message: `AFK-ready Work Item must have at least one Validation Method: ${workItem.id}`,
        nodeId: workItem.id
      });
    }

    const blockers = afkBlockers(graph, workItem, nodeById);
    for (const blocker of blockers) {
      semanticErrors.push({
        code: "invalid_afk_readiness",
        message: `AFK-ready Work Item has unresolved blocker: ${workItem.id}: ${blocker}`,
        nodeId: workItem.id
      });
    }
  }

  const readinessSummary = summarizeReadiness(readinessSnapshots);
  const status = semanticErrors.length > 0 ? "error" : semanticWarnings.length > 0 ? "warning" : "pass";

  return {
    graphVersion: graph.graphVersion,
    status,
    schemaStatus: "not_run",
    semanticErrors,
    semanticWarnings,
    readinessSummary,
    readinessSnapshots
  };
}

export function deriveReadinessSnapshot(
  graph: PlanningGraph,
  workItem: WorkItemNode,
  nodeById = new Map<string, PlanningNode>(graph.nodes.map((node) => [node.id, node])),
  graphErrors: readonly ValidationFinding[] = []
): ReadinessSnapshot {
  if (workItem.executionState === "done") {
    return {
      graphVersion: graph.graphVersion,
      labels: ["agent_eligible", "afk_ready"],
      reasons: ["Work Item is complete and already validated."]
    };
  }

  const blockers = afkBlockers(graph, workItem, nodeById);
  const itemErrors = graphErrors.filter((finding) => finding.nodeId === workItem.id);

  if (blockers.length > 0 || itemErrors.length > 0) {
    return {
      graphVersion: graph.graphVersion,
      labels: blockers.some((reason) => reason.includes("HITL"))
        ? ["agent_eligible", "hitl_gated", "blocked"]
        : ["agent_eligible", "blocked"],
      reasons: [...blockers, ...itemErrors.map((finding) => finding.message)]
    };
  }

  return {
    graphVersion: graph.graphVersion,
    labels: ["agent_eligible", "afk_ready"],
    reasons: ["No unresolved Work Item dependencies or semantic AFK blockers remain."]
  };
}

function afkBlockers(
  graph: PlanningGraph,
  workItem: WorkItemNode,
  nodeById: ReadonlyMap<string, PlanningNode>
): readonly string[] {
  const reasons: string[] = [];

  for (const edge of graph.edges.filter((candidate) => candidate.source === workItem.id)) {
    const target = nodeById.get(edge.target);
    if (!target) {
      continue;
    }

    if (edge.type === "depends_on" && isWorkItem(target) && target.executionState !== "done") {
      reasons.push(`Depends on ${target.id}, which is ${target.executionState}.`);
    }

    if (edge.type === "depends_on" && target.kind === "decision" && target.status !== "accepted") {
      reasons.push(`Depends on unresolved Decision ${target.id}.`);
    }

    if (edge.type === "depends_on" && target.kind === "assumption" && target.blocksAfk) {
      reasons.push(`Depends on high-impact blocking Assumption ${target.id}.`);
    }

    if (edge.type === "depends_on" && target.kind === "risk" && target.blocksAfk && !isRiskMitigated(graph, target.id, nodeById)) {
      reasons.push(`Depends on unmitigated high-impact Risk ${target.id}.`);
    }
  }

  for (const hitlGate of graph.nodes.filter(isHitlGate)) {
    if (hitlGate.blocks.includes(workItem.id) && hitlGate.status !== "accepted" && hitlGate.status !== "resolved") {
      reasons.push(`Blocked by unresolved HITL Gate ${hitlGate.id}.`);
    }
  }

  return reasons;
}

function isRiskMitigated(graph: PlanningGraph, riskId: PlanningNodeId, nodeById: ReadonlyMap<string, PlanningNode>): boolean {
  return graph.edges.some((edge) => {
    const source = nodeById.get(edge.source);
    return edge.type === "mitigates" && edge.target === riskId && isWorkItem(source) && source.executionState === "done";
  });
}

function summarizeReadiness(snapshots: Readonly<Record<string, ReadinessSnapshot>>): ReadinessSummary {
  const entries = Object.entries(snapshots);
  const idsWith = (label: ReadinessLabel) =>
    entries.filter(([, snapshot]) => snapshot.labels.includes(label)).map(([id]) => id as WorkItemId);

  return {
    afkReady: idsWith("afk_ready"),
    agentEligible: idsWith("agent_eligible"),
    blocked: idsWith("blocked"),
    hitlGated: idsWith("hitl_gated"),
    humanOnly: idsWith("human_only")
  };
}

function detectWorkItemCycles(graph: PlanningGraph, nodeById: ReadonlyMap<string, PlanningNode>): readonly WorkItemId[][] {
  const dependencies = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (edge.type === "depends_on" && isWorkItem(source) && isWorkItem(target)) {
      dependencies.set(source.id, [...(dependencies.get(source.id) ?? []), target.id]);
    }
  }

  const cycles: WorkItemId[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      cycles.push(path.slice(path.indexOf(id)).concat(id) as WorkItemId[]);
      return;
    }

    if (visited.has(id)) {
      return;
    }

    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      visit(dependency, [...path, dependency]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of dependencies.keys()) {
    visit(id, [id]);
  }

  return cycles;
}

function isRequirementOrAcceptedDecision(node: PlanningNode | undefined): boolean {
  return node?.kind === "requirement" || (node?.kind === "decision" && node.status === "accepted");
}

function isWorkItem(node: PlanningNode | undefined): node is WorkItemNode {
  return node?.kind === "work_item";
}

function isHitlGate(node: PlanningNode): node is HitlGateNode {
  return node.kind === "hitl_gate";
}

function isDocumentProjection(node: PlanningNode): node is DocumentProjectionNode {
  return node.kind === "document_projection";
}
