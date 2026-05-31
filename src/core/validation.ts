import type {
  DependencyEdge,
  DocumentProjectionNode,
  HitlGateNode,
  ComponentNode,
  PlanningGraph,
  PlanningNode,
  PlanningNodeId,
  ReadinessLabel,
  ReadinessSnapshot,
  WorkItemId,
  WorkItemNode
} from "./graph.js";
import { isSupportedPlanningGraphSchemaVersion } from "./graph.js";
import {
  hasPlaceholderText,
  hasScaffoldManualValidation,
  isFallbackWorkItem,
  isScaffoldedProductIntent
} from "./planning-quality.js";

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
  readonly schemaErrors: readonly ValidationFinding[];
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

  if (!isSupportedPlanningGraphSchemaVersion(graph.schemaVersion)) {
    semanticErrors.push({
      code: "unsupported_schema_version",
      message: `Unsupported Planning Graph schema_version "${graph.schemaVersion}". Supported V1 schema_version values: 0.1.0. Migrations are not available in V1.`
    });
  }

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

    if (document.path && !isSafeRelativePath(document.path)) {
      semanticErrors.push({
        code: "document_projection_unsafe_path",
        message: `Document Projection path must be a safe relative path within the workspace: ${document.id}`,
        nodeId: document.id
      });
    }
  }

  for (const component of graph.nodes.filter(isComponent)) {
    if (component.interfaces.some((componentInterface) => !componentInterface.name.trim() || !componentInterface.contract.trim())) {
      semanticErrors.push({
        code: "component_interface_missing_contract",
        message: `Component interface must include a name and contract: ${component.id}`,
        nodeId: component.id
      });
    }

    if (
      component.interfaces.some(
        (componentInterface) => !["inbound", "outbound", "internal"].includes(componentInterface.direction)
      )
    ) {
      semanticErrors.push({
        code: "component_interface_invalid_direction",
        message: `Component interface direction must be inbound, outbound, or internal: ${component.id}`,
        nodeId: component.id
      });
    }

    for (const dependency of component.dependsOn) {
      const target = nodeById.get(dependency);
      if (dependency === component.id) {
        semanticErrors.push({
          code: "component_self_dependency",
          message: `Component must not depend on itself: ${component.id}`,
          nodeId: component.id
        });
      }

      if (target?.kind !== "component") {
        semanticErrors.push({
          code: "component_dependency_missing",
          message: `Component dependency must reference an existing Component: ${component.id} depends on ${dependency}`,
          nodeId: component.id
        });
      }
    }
  }

  for (const edge of graph.edges.filter((candidate) => candidate.type === "references")) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (target?.kind !== "component") {
      continue;
    }

    if (!isWorkItem(source) && !isDocumentProjection(source)) {
      semanticErrors.push({
        code: "component_reference_invalid_source",
        message: `Component reference must come from a Work Item or Document Projection: ${edge.source} references ${edge.target}`,
        edge
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

  for (const hitlGate of graph.nodes.filter(isHitlGate)) {
    if (!hitlGate.requiredAction.trim()) {
      semanticErrors.push({
        code: "hitl_gate_missing_required_action",
        message: `HITL Gate must explain the required human action: ${hitlGate.id}`,
        nodeId: hitlGate.id
      });
    }

    if (hitlGate.blocks.length === 0 && hitlGate.status !== "accepted" && hitlGate.status !== "resolved") {
      semanticErrors.push({
        code: "hitl_gate_missing_blocked_work_items",
        message: `Active HITL Gate must block at least one Work Item: ${hitlGate.id}`,
        nodeId: hitlGate.id
      });
    }

    for (const workItemId of hitlGate.blocks) {
      if (!isWorkItem(nodeById.get(workItemId))) {
        semanticErrors.push({
          code: "hitl_gate_blocks_missing_work_item",
          message: `HITL Gate blocks must reference existing Work Items: ${hitlGate.id} blocks ${workItemId}`,
          nodeId: hitlGate.id
        });
      }
    }

    const hasCauseLink = graph.edges.some(
      (edge) => edge.source === hitlGate.id && edge.type === "references" && nodeById.has(edge.target)
    );
    if (hitlGate.status !== "accepted" && hitlGate.status !== "resolved" && !hasCauseLink) {
      semanticErrors.push({
        code: "hitl_gate_missing_cause_link",
        message: `HITL Gate must reference the uncertainty that caused it: ${hitlGate.id}`,
        nodeId: hitlGate.id
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
    schemaErrors: [],
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
  const readinessBlockers = afkReadinessBlockers(graph, workItem);
  const itemErrors = graphErrors.filter((finding) => finding.nodeId === workItem.id);

  if (blockers.length > 0 || readinessBlockers.length > 0 || itemErrors.length > 0) {
    return {
      graphVersion: graph.graphVersion,
      labels: blockers.some((reason) => reason.includes("HITL"))
        ? ["agent_eligible", "hitl_gated", "blocked"]
        : ["agent_eligible", "blocked"],
      reasons: [...blockers, ...readinessBlockers, ...itemErrors.map((finding) => finding.message)]
    };
  }

  return {
    graphVersion: graph.graphVersion,
    labels: ["agent_eligible", "afk_ready"],
    reasons: ["Context, boundaries, validation, dependency closure, and safe-failure guidance are AFK-ready."]
  };
}

function afkReadinessBlockers(graph: PlanningGraph, workItem: WorkItemNode): readonly string[] {
  const reasons: string[] = [];

  const hasContextSummary = Boolean(workItem.contextSummary?.trim());
  const hasTraceContext = graph.edges.some(
    (edge) =>
      edge.source === workItem.id &&
      ["satisfies", "references"].includes(edge.type) &&
      Boolean(graph.nodes.find((node) => node.id === edge.target && isRequirementOrAcceptedDecision(node)))
  );
  if (!hasContextSummary && !hasTraceContext) {
    reasons.push("Missing context: add a context_summary or trace the Work Item to a Requirement or accepted Decision.");
  }

  if ((workItem.boundaryNotes ?? []).filter((note) => note.trim()).length === 0) {
    reasons.push("Missing boundaries/non-goals: add boundary_notes that constrain autonomous implementation.");
  }

  if (!hasAfkValidation(workItem)) {
    reasons.push("Missing executable or safe manual validation: add a command/test validation method with a command, or document safe manual validation.");
  }

  if (!workItem.safeFailureGuidance?.trim()) {
    reasons.push("Missing safe-failure guidance: add safe_failure_guidance that tells the agent how to stop or report uncertainty.");
  }

  reasons.push(...scaffoldReadinessBlockers(graph, workItem));

  return reasons;
}

function scaffoldReadinessBlockers(graph: PlanningGraph, workItem: WorkItemNode): readonly string[] {
  const reasons: string[] = [];

  if (graph.productIntent && isScaffoldedProductIntent(graph.productIntent)) {
    reasons.push("Scaffolded Product Intent: replace TODO placeholders before marking Work Items AFK-ready.");
  }

  if (isFallbackWorkItem(workItem)) {
    reasons.push(`Scaffolded Work Item: ${workItem.id} must be replaced with a concrete, bounded execution slice before AFK-ready.`);
  }

  if (hasScaffoldManualValidation(workItem)) {
    reasons.push("Scaffolded validation: replace deterministic safe-manual-validation text with executable validation or explicit user-authored manual review.");
  }

  if (isPlaceholderProvenance(workItem)) {
    reasons.push(`Placeholder provenance: ${workItem.id} still comes from deterministic planner inference and needs explicit confirmation before AFK-ready.`);
  }

  return reasons;
}

function hasAfkValidation(workItem: WorkItemNode): boolean {
  return workItem.validationMethods.some((method) => {
    if ((method.type === "command" || method.type === "test") && method.command?.trim()) {
      return true;
    }

    return method.type === "manual_review" && /\bsafe manual validation\b/i.test(method.expectedResult);
  });
}

function isPlaceholderProvenance(workItem: WorkItemNode): boolean {
  return Boolean(
    workItem.provenance?.sourceType === "planner_inference" &&
      workItem.provenance.confidence !== "high" &&
      (hasPlaceholderText(workItem.provenance.sourceReference) ||
        /theplanner plan --dry-run/iu.test(workItem.provenance.createdBy))
  );
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

    if (edge.type === "depends_on" && target.kind === "open_question" && target.blocksExecution) {
      reasons.push(`Depends on execution-blocking Open Question ${target.id}.`);
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

function isDocumentProjection(node: PlanningNode | undefined): node is DocumentProjectionNode {
  return node?.kind === "document_projection";
}

function isComponent(node: PlanningNode | undefined): node is ComponentNode {
  return node?.kind === "component";
}

function isSafeRelativePath(path: string): boolean {
  const parts = path.split(/[\\/]/u);
  return (
    path.trim() !== "" &&
    !path.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/u.test(path) &&
    !parts.some((part) => part === "" || part === "." || part === "..")
  );
}
