import type {
  DecisionNode,
  DependencyEdge,
  ExecutionState,
  HitlGateNode,
  OpenQuestionNode,
  PlanningGraph,
  PlanningNode,
  Provenance,
  RequirementNode,
  ValidationMethod,
  WorkItemNode
} from "./graph.js";
import { graphVersion, stableId } from "./graph.js";
import { deriveReadinessSnapshot, validatePlanningGraph } from "./validation.js";

export type ProposedGraphOperation =
  | AddOpenQuestionGraphOperation
  | AddRequirementGraphOperation
  | AddDecisionGraphOperation
  | AddWorkItemGraphOperation
  | AddDependencyEdgeGraphOperation
  | AddHitlGateGraphOperation
  | UpdateWorkItemExecutionStateGraphOperation;

export type GraphOperationApprovalCategory =
  | "none"
  | "commitment_changing"
  | "scope_changing"
  | "architecture_changing"
  | "risk_changing"
  | "readiness_changing"
  | "safety_relevant";

export interface GraphOperationApprovalClassification {
  readonly category: GraphOperationApprovalCategory;
  readonly rationale: string;
}

export interface AddOpenQuestionGraphOperation {
  readonly kind: "AddOpenQuestion";
  readonly openQuestion: OpenQuestionNode;
}

export interface AddRequirementGraphOperation {
  readonly kind: "AddRequirement";
  readonly requirement: RequirementNode;
}

export interface AddDecisionGraphOperation {
  readonly kind: "AddDecision";
  readonly decision: DecisionNode;
  readonly approvalClassification?: GraphOperationApprovalClassification;
}

export interface AddWorkItemGraphOperation {
  readonly kind: "AddWorkItem";
  readonly workItem: WorkItemNode;
  readonly edges: readonly DependencyEdge[];
}

export interface AddDependencyEdgeGraphOperation {
  readonly kind: "AddDependencyEdge";
  readonly edge: DependencyEdge;
}

export interface AddHitlGateGraphOperation {
  readonly kind: "AddHitlGate";
  readonly hitlGate: HitlGateNode;
  readonly edges: readonly DependencyEdge[];
}

export interface UpdateWorkItemExecutionStateGraphOperation {
  readonly kind: "UpdateWorkItemExecutionState";
  readonly workItemId: WorkItemNode["id"];
  readonly executionState: ExecutionState;
  readonly rationale: string;
  readonly provenance: Provenance;
}

export interface GraphOperationFinding {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

export interface GraphOperationApprovalSummary {
  readonly required: boolean;
  readonly category: GraphOperationApprovalCategory;
  readonly rationale: string;
}

export type GraphOperationApplyResult =
  | {
      readonly status: "applied";
      readonly candidateGraph: PlanningGraph;
      readonly approval: GraphOperationApprovalSummary;
    }
  | {
      readonly status: "rejected";
      readonly errors: readonly GraphOperationFinding[];
    };

export function applyGraphOperationToCandidate(
  graph: PlanningGraph,
  operation: ProposedGraphOperation
): GraphOperationApplyResult {
  const operationErrors = validateGraphOperation(graph, operation);
  if (operationErrors.length > 0) {
    return {
      status: "rejected",
      errors: operationErrors
    };
  }

  const candidateGraph = deepClonePlanningGraph(graph);
  const operationClone = deepCloneGraphOperation(operation);

  if (operationClone.kind === "AddOpenQuestion") {
    return {
      status: "applied",
      approval: approvalNotRequired(),
      candidateGraph: {
        ...candidateGraph,
        graphVersion: graphVersion(Number(candidateGraph.graphVersion) + 1),
        nodes: [...candidateGraph.nodes, operationClone.openQuestion]
      }
    };
  }

  if (operationClone.kind === "AddRequirement") {
    return {
      status: "applied",
      approval: approvalNotRequired(),
      candidateGraph: addNodeToCandidateGraph(candidateGraph, operationClone.requirement)
    };
  }

  if (operationClone.kind === "AddDecision") {
    return {
      status: "applied",
      approval: decisionApprovalSummary(operationClone),
      candidateGraph: addNodeToCandidateGraph(candidateGraph, operationClone.decision)
    };
  }

  if (operationClone.kind === "AddWorkItem") {
    return {
      status: "applied",
      approval: approvalNotRequired(),
      candidateGraph: addWorkItemToCandidateGraph(candidateGraph, operationClone)
    };
  }

  if (operationClone.kind === "AddDependencyEdge") {
    return {
      status: "applied",
      approval: {
        required: true,
        category: "readiness_changing",
        rationale: "Dependency Edge proposals can change Work Item readiness."
      },
      candidateGraph: addDependencyEdgeToCandidateGraph(candidateGraph, operationClone)
    };
  }

  if (operationClone.kind === "AddHitlGate") {
    return {
      status: "applied",
      approval: {
        required: true,
        category: "readiness_changing",
        rationale: "HITL Gate proposals can block Work Item readiness."
      },
      candidateGraph: addHitlGateToCandidateGraph(candidateGraph, operationClone)
    };
  }

  if (operationClone.kind === "UpdateWorkItemExecutionState") {
    return {
      status: "applied",
      approval: {
        required: true,
        category: "readiness_changing",
        rationale: "Execution-state proposals change Work Item planning state."
      },
      candidateGraph: updateWorkItemExecutionStateOnCandidateGraph(candidateGraph, operationClone)
    };
  }

  return {
    status: "rejected",
    errors: [
      {
        code: "unsupported_graph_operation",
        message: "Unsupported Proposed Graph Operation."
      }
    ]
  };
}

export function validateGraphOperation(
  graph: PlanningGraph,
  operation: ProposedGraphOperation
): readonly GraphOperationFinding[] {
  if (operation.kind === "AddOpenQuestion") {
    return validateAddOpenQuestionOperation(graph, operation);
  }

  if (operation.kind === "AddRequirement") {
    return validateAddRequirementOperation(graph, operation);
  }

  if (operation.kind === "AddDecision") {
    return validateAddDecisionOperation(graph, operation);
  }

  if (operation.kind === "AddWorkItem") {
    return validateAddWorkItemOperation(graph, operation);
  }

  if (operation.kind === "AddDependencyEdge") {
    return validateAddDependencyEdgeOperation(graph, operation);
  }

  if (operation.kind === "AddHitlGate") {
    return validateAddHitlGateOperation(graph, operation);
  }

  if (operation.kind === "UpdateWorkItemExecutionState") {
    return validateUpdateWorkItemExecutionStateOperation(graph, operation);
  }

  return [
    {
      code: "unsupported_graph_operation",
      message: "Unsupported Proposed Graph Operation."
    }
  ];
}

function validateAddOpenQuestionOperation(
  graph: PlanningGraph,
  operation: AddOpenQuestionGraphOperation
): readonly GraphOperationFinding[] {
  const openQuestion = operation.openQuestion;
  const errors: GraphOperationFinding[] = [];

  if (!openQuestion.id) {
    errors.push({
      code: "open_question_id_required",
      message: "AddOpenQuestion requires open_question.id."
    });
  } else {
    try {
      stableId(openQuestion.id, "oq");
    } catch {
      errors.push({
        code: "open_question_id_invalid",
        message: `Open Question id must match oq-NNN: ${openQuestion.id}`,
        nodeId: openQuestion.id
      });
    }
  }

  if (graph.nodes.some((node) => node.id === openQuestion.id)) {
    errors.push({
      code: "graph_operation_duplicate_node_id",
      message: `Planning Graph already contains node id: ${openQuestion.id}`,
      nodeId: openQuestion.id
    });
  }

  if (openQuestion.kind !== "open_question") {
    errors.push({
      code: "open_question_kind_invalid",
      message: "AddOpenQuestion can only add an open_question node.",
      nodeId: openQuestion.id
    });
  }

  if (!openQuestion.title.trim()) {
    errors.push({
      code: "open_question_title_required",
      message: "AddOpenQuestion requires a non-empty title.",
      nodeId: openQuestion.id
    });
  }

  if (!openQuestion.question.trim()) {
    errors.push({
      code: "open_question_question_required",
      message: "AddOpenQuestion requires a non-empty question.",
      nodeId: openQuestion.id
    });
  }

  if (!["low", "medium", "high"].includes(openQuestion.priority)) {
    errors.push({
      code: "open_question_priority_invalid",
      message: "AddOpenQuestion priority must be low, medium, or high.",
      nodeId: openQuestion.id
    });
  }

  if (typeof openQuestion.blocksExecution !== "boolean") {
    errors.push({
      code: "open_question_blocks_execution_invalid",
      message: "AddOpenQuestion blocksExecution must be a boolean.",
      nodeId: openQuestion.id
    });
  }

  errors.push(...validateRequiredProvenance(openQuestion));

  return errors;
}

function validateAddRequirementOperation(
  graph: PlanningGraph,
  operation: AddRequirementGraphOperation
): readonly GraphOperationFinding[] {
  const requirement = operation.requirement;
  const errors: GraphOperationFinding[] = [];

  errors.push(...validateNodeId(graph, requirement, "req", "Requirement", "AddRequirement"));

  if (requirement.kind !== "requirement") {
    errors.push({
      code: "requirement_kind_invalid",
      message: "AddRequirement can only add a requirement node.",
      nodeId: requirement.id
    });
  }

  if (!requirement.title.trim()) {
    errors.push({
      code: "requirement_title_required",
      message: "AddRequirement requires a non-empty title.",
      nodeId: requirement.id
    });
  }

  if (!["functional", "non_functional", "constraint"].includes(requirement.requirementType)) {
    errors.push({
      code: "requirement_type_invalid",
      message: "AddRequirement type must be functional, non_functional, or constraint.",
      nodeId: requirement.id
    });
  }

  if (!requirement.statement.trim()) {
    errors.push({
      code: "requirement_statement_required",
      message: "AddRequirement requires a non-empty statement.",
      nodeId: requirement.id
    });
  }

  if (!["active", "planned"].includes(requirement.status)) {
    errors.push({
      code: "requirement_status_invalid",
      message: "AddRequirement status must be active or planned.",
      nodeId: requirement.id
    });
  }

  errors.push(...validateRequiredProvenance(requirement));

  return errors;
}

function validateAddDecisionOperation(graph: PlanningGraph, operation: AddDecisionGraphOperation): readonly GraphOperationFinding[] {
  const decision = operation.decision;
  const errors: GraphOperationFinding[] = [];

  errors.push(...validateNodeId(graph, decision, "dec", "Decision", "AddDecision"));

  if (decision.kind !== "decision") {
    errors.push({
      code: "decision_kind_invalid",
      message: "AddDecision can only add a decision node.",
      nodeId: decision.id
    });
  }

  if (!decision.title.trim()) {
    errors.push({
      code: "decision_title_required",
      message: "AddDecision requires a non-empty title.",
      nodeId: decision.id
    });
  }

  if (!["accepted", "proposed", "revisit"].includes(decision.status)) {
    errors.push({
      code: "decision_status_invalid",
      message: "AddDecision status must be accepted, proposed, or revisit.",
      nodeId: decision.id
    });
  }

  if (!decision.selectedOption.trim()) {
    errors.push({
      code: "decision_selected_option_required",
      message: "AddDecision requires a non-empty selected option.",
      nodeId: decision.id
    });
  }

  if (!decision.rationale.trim()) {
    errors.push({
      code: "decision_rationale_required",
      message: "AddDecision requires a non-empty rationale.",
      nodeId: decision.id
    });
  }

  if (!Array.isArray(decision.rejectedAlternatives)) {
    errors.push({
      code: "decision_rejected_alternatives_invalid",
      message: "AddDecision rejected alternatives must be an array.",
      nodeId: decision.id
    });
  }

  if (!Array.isArray(decision.unresolvedQuestions)) {
    errors.push({
      code: "decision_unresolved_questions_invalid",
      message: "AddDecision unresolved questions must be an array.",
      nodeId: decision.id
    });
  }

  errors.push(...validateDecisionApprovalClassification(operation));
  errors.push(...validateRequiredProvenance(decision));

  return errors;
}

function validateAddWorkItemOperation(graph: PlanningGraph, operation: AddWorkItemGraphOperation): readonly GraphOperationFinding[] {
  const workItem = operation.workItem;
  const errors: GraphOperationFinding[] = [];

  errors.push(...validateNodeId(graph, workItem, "wi", "Work Item", "AddWorkItem"));

  if (workItem.kind !== "work_item") {
    errors.push({
      code: "work_item_kind_invalid",
      message: "AddWorkItem can only add a work_item node.",
      nodeId: workItem.id
    });
  }

  if (!workItem.title.trim()) {
    errors.push({
      code: "work_item_title_required",
      message: "AddWorkItem requires a non-empty title.",
      nodeId: workItem.id
    });
  }

  if (!["backlog", "ready", "in_progress", "review", "done", "cancelled", "deferred"].includes(workItem.executionState)) {
    errors.push({
      code: "work_item_execution_state_invalid",
      message: "AddWorkItem execution state is not supported.",
      nodeId: workItem.id
    });
  }

  errors.push(...validateRequiredProvenance(workItem));
  errors.push(...validateStrictWorkItemProposal(workItem));
  errors.push(...validateWorkItemOperationEdges(graph, operation));

  return errors;
}

function validateAddDependencyEdgeOperation(
  graph: PlanningGraph,
  operation: AddDependencyEdgeGraphOperation
): readonly GraphOperationFinding[] {
  const errors = validateDependencyEdgeReferences(graph, operation.edge, "AddDependencyEdge");

  if (operation.edge.type === "depends_on" && operation.edge.source === operation.edge.target) {
    errors.push({
      code: "dependency_edge_self_dependency",
      message: `AddDependencyEdge depends_on edge must not reference the same source and target: ${operation.edge.source}`,
      nodeId: operation.edge.source
    });
  }

  if (graph.edges.some((edge) => edgeKey(edge) === edgeKey(operation.edge))) {
    errors.push({
      code: "dependency_edge_duplicate",
      message: `Planning Graph already contains dependency edge: ${operation.edge.source} ${operation.edge.type} ${operation.edge.target}`,
      nodeId: operation.edge.source
    });
  }

  return errors;
}

function validateAddHitlGateOperation(graph: PlanningGraph, operation: AddHitlGateGraphOperation): readonly GraphOperationFinding[] {
  const hitlGate = operation.hitlGate;
  const errors: GraphOperationFinding[] = [];
  const nodeById = new Map<string, PlanningNode>(graph.nodes.map((node) => [node.id, node]));

  errors.push(...validateNodeId(graph, hitlGate, "hitl", "HITL Gate", "AddHitlGate"));

  if (hitlGate.kind !== "hitl_gate") {
    errors.push({
      code: "hitl_gate_kind_invalid",
      message: "AddHitlGate can only add a hitl_gate node.",
      nodeId: hitlGate.id
    });
  }

  if (!hitlGate.title.trim()) {
    errors.push({
      code: "hitl_gate_title_required",
      message: "AddHitlGate requires a non-empty title.",
      nodeId: hitlGate.id
    });
  }

  if (!["active", "accepted", "resolved", "planned"].includes(hitlGate.status)) {
    errors.push({
      code: "hitl_gate_status_invalid",
      message: "AddHitlGate status must be active, accepted, resolved, or planned.",
      nodeId: hitlGate.id
    });
  }

  if (!hitlGate.requiredAction.trim()) {
    errors.push({
      code: "hitl_gate_missing_required_action",
      message: `HITL Gate must explain the required human action: ${hitlGate.id}`,
      nodeId: hitlGate.id
    });
  }

  if (hitlGate.blocks.length === 0 && hitlGate.status !== "accepted" && hitlGate.status !== "resolved") {
    errors.push({
      code: "hitl_gate_missing_blocked_work_items",
      message: `Active HITL Gate must block at least one Work Item: ${hitlGate.id}`,
      nodeId: hitlGate.id
    });
  }

  for (const workItemId of hitlGate.blocks) {
    if (!isWorkItem(nodeById.get(workItemId))) {
      errors.push({
        code: "hitl_gate_blocks_missing_work_item",
        message: `HITL Gate blocks must reference existing Work Items: ${hitlGate.id} blocks ${workItemId}`,
        nodeId: hitlGate.id
      });
    }
  }

  for (const edge of operation.edges) {
    if (edge.source !== hitlGate.id) {
      errors.push({
        code: "hitl_gate_edge_source_invalid",
        message: `AddHitlGate edges must start from the new HITL Gate: ${hitlGate.id}`,
        nodeId: hitlGate.id
      });
    }

    if (edge.target === hitlGate.id) {
      errors.push({
        code: "hitl_gate_edge_self_reference",
        message: `AddHitlGate edge must not reference itself: ${hitlGate.id}`,
        nodeId: hitlGate.id
      });
    }

    if (edge.source !== hitlGate.id && !nodeById.has(edge.source)) {
      errors.push({
        code: "dependency_edge_source_missing",
        message: `AddHitlGate edge source does not exist: ${edge.source}`,
        nodeId: hitlGate.id
      });
    }

    if (!nodeById.has(edge.target)) {
      errors.push({
        code: "dependency_edge_target_missing",
        message: `AddHitlGate edge target does not exist: ${edge.target}`,
        nodeId: hitlGate.id
      });
    }

    if (!edge.rationale.trim()) {
      errors.push({
        code: "dependency_edge_rationale_required",
        message: `AddHitlGate edge requires a non-empty rationale: ${edge.source} ${edge.type} ${edge.target}`,
        nodeId: hitlGate.id
      });
    }
  }

  const hasCauseLink = operation.edges.some(
    (edge) => edge.source === hitlGate.id && edge.type === "references" && nodeById.has(edge.target)
  );
  if (hitlGate.status !== "accepted" && hitlGate.status !== "resolved" && !hasCauseLink) {
    errors.push({
      code: "hitl_gate_missing_cause_link",
      message: `HITL Gate must reference the uncertainty that caused it: ${hitlGate.id}`,
      nodeId: hitlGate.id
    });
  }

  errors.push(...validateRequiredProvenance(hitlGate));

  return errors;
}

function validateUpdateWorkItemExecutionStateOperation(
  graph: PlanningGraph,
  operation: UpdateWorkItemExecutionStateGraphOperation
): readonly GraphOperationFinding[] {
  const errors: GraphOperationFinding[] = [];
  const workItem = graph.nodes.find((node): node is WorkItemNode => node.kind === "work_item" && node.id === operation.workItemId);

  if (!workItem) {
    errors.push({
      code: "work_item_not_found",
      message: `UpdateWorkItemExecutionState requires an existing Work Item: ${operation.workItemId}`,
      nodeId: operation.workItemId
    });
  }

  if (!["backlog", "ready", "in_progress", "review", "done", "cancelled", "deferred"].includes(operation.executionState)) {
    errors.push({
      code: "work_item_execution_state_invalid",
      message: "UpdateWorkItemExecutionState execution state is not supported.",
      nodeId: operation.workItemId
    });
  }

  if (workItem?.executionState === operation.executionState) {
    errors.push({
      code: "work_item_execution_state_unchanged",
      message: `Work Item ${operation.workItemId} is already ${operation.executionState}.`,
      nodeId: operation.workItemId
    });
  }

  if (!operation.rationale.trim()) {
    errors.push({
      code: "work_item_execution_state_rationale_required",
      message: "UpdateWorkItemExecutionState requires a non-empty rationale.",
      nodeId: operation.workItemId
    });
  }

  errors.push(...validateRequiredProvenanceForOperation(operation.provenance, operation.workItemId));

  return errors;
}

function validateNodeId(
  graph: PlanningGraph,
  node: PlanningNode,
  prefix: "req" | "dec" | "oq" | "wi" | "hitl",
  label: string,
  operationName: string
): readonly GraphOperationFinding[] {
  const errors: GraphOperationFinding[] = [];

  if (!node.id) {
    errors.push({
      code: `${label.toLowerCase()}_id_required`,
      message: `${operationName} requires ${label.toLowerCase()}.id.`
    });
  } else {
    try {
      stableId(node.id, prefix);
    } catch {
      errors.push({
        code: `${label.toLowerCase()}_id_invalid`,
        message: `${label} id must match ${prefix}-NNN: ${node.id}`,
        nodeId: node.id
      });
    }
  }

  if (graph.nodes.some((existing) => existing.id === node.id)) {
    errors.push({
      code: "graph_operation_duplicate_node_id",
      message: `Planning Graph already contains node id: ${node.id}`,
      nodeId: node.id
    });
  }

  return errors;
}

function validateDependencyEdgeReferences(
  graph: PlanningGraph,
  edge: DependencyEdge,
  operationName: string
): GraphOperationFinding[] {
  const errors: GraphOperationFinding[] = [];
  const nodeById = new Map<string, PlanningNode>(graph.nodes.map((node) => [node.id, node]));

  if (!nodeById.has(edge.source)) {
    errors.push({
      code: "dependency_edge_source_missing",
      message: `${operationName} edge source does not exist: ${edge.source}`,
      nodeId: edge.source
    });
  }

  if (!nodeById.has(edge.target)) {
    errors.push({
      code: "dependency_edge_target_missing",
      message: `${operationName} edge target does not exist: ${edge.target}`,
      nodeId: edge.source
    });
  }

  if (!["depends_on", "blocks", "satisfies", "mitigates", "raises", "references", "supersedes"].includes(edge.type)) {
    errors.push({
      code: "dependency_edge_type_invalid",
      message: `${operationName} edge type is not supported: ${edge.type}`,
      nodeId: edge.source
    });
  }

  if (!edge.rationale.trim()) {
    errors.push({
      code: "dependency_edge_rationale_required",
      message: `${operationName} edge requires a non-empty rationale: ${edge.source} ${edge.type} ${edge.target}`,
      nodeId: edge.source
    });
  }

  return errors;
}

function validateStrictWorkItemProposal(workItem: WorkItemNode): readonly GraphOperationFinding[] {
  const errors: GraphOperationFinding[] = [];

  if (workItem.acceptanceCriteria.filter((criterion) => criterion.trim()).length === 0) {
    errors.push({
      code: "work_item_acceptance_criteria_required",
      message: "LLM-origin AddWorkItem proposals require at least one non-empty acceptance criterion.",
      nodeId: workItem.id
    });
  }

  if (!hasExecutableValidationMethod(workItem.validationMethods)) {
    errors.push({
      code: "work_item_executable_validation_required",
      message: "LLM-origin AddWorkItem proposals require a command or test validation method with an explicit command.",
      nodeId: workItem.id
    });
  }

  if (!workItem.contextSummary?.trim()) {
    errors.push({
      code: "work_item_context_summary_required",
      message: "LLM-origin AddWorkItem proposals require a context summary.",
      nodeId: workItem.id
    });
  }

  if ((workItem.boundaryNotes ?? []).filter((note) => note.trim()).length === 0) {
    errors.push({
      code: "work_item_boundary_notes_required",
      message: "LLM-origin AddWorkItem proposals require boundary notes.",
      nodeId: workItem.id
    });
  }

  if (!workItem.safeFailureGuidance?.trim()) {
    errors.push({
      code: "work_item_safe_failure_guidance_required",
      message: "LLM-origin AddWorkItem proposals require safe-failure guidance.",
      nodeId: workItem.id
    });
  }

  return errors;
}

function validateWorkItemOperationEdges(
  graph: PlanningGraph,
  operation: AddWorkItemGraphOperation
): readonly GraphOperationFinding[] {
  const errors: GraphOperationFinding[] = [];
  const nodeById = new Map<string, PlanningNode>(graph.nodes.map((node) => [node.id, node]));

  for (const edge of operation.edges) {
    if (edge.source !== operation.workItem.id) {
      errors.push({
        code: "work_item_edge_source_invalid",
        message: `AddWorkItem edges must start from the new Work Item: ${operation.workItem.id}`,
        nodeId: operation.workItem.id
      });
    }

    const target = nodeById.get(edge.target);
    if (!target) {
      errors.push({
        code: "work_item_edge_target_missing",
        message: `AddWorkItem edge target does not exist: ${edge.target}`,
        nodeId: operation.workItem.id
      });
    }

    if (!edge.rationale.trim()) {
      errors.push({
        code: "work_item_edge_rationale_required",
        message: `AddWorkItem edge requires a non-empty rationale: ${edge.source} ${edge.type} ${edge.target}`,
        nodeId: operation.workItem.id
      });
    }
  }

  const hasTraceability = operation.edges.some((edge) => {
    const target = nodeById.get(edge.target);
    return edge.source === operation.workItem.id && ["satisfies", "references"].includes(edge.type) && isRequirementOrAcceptedDecision(target);
  });

  if (!hasTraceability) {
    errors.push({
      code: "work_item_traceability_required",
      message: "LLM-origin AddWorkItem proposals require traceability to at least one Requirement or accepted Decision.",
      nodeId: operation.workItem.id
    });
  }

  return errors;
}

function hasExecutableValidationMethod(methods: readonly ValidationMethod[]): boolean {
  return methods.some((method) => (method.type === "command" || method.type === "test") && Boolean(method.command?.trim()));
}

function validateDecisionApprovalClassification(
  operation: AddDecisionGraphOperation
): readonly GraphOperationFinding[] {
  const classification = operation.approvalClassification;
  if (!classification) {
    if (operation.decision.status === "accepted") {
      return [
        {
          code: "decision_approval_classification_required",
          message: "Accepted Decision proposals require an explicit approval classification.",
          nodeId: operation.decision.id
        }
      ];
    }

    return [];
  }

  const errors: GraphOperationFinding[] = [];
  if (!approvalCategories.includes(classification.category)) {
    errors.push({
      code: "decision_approval_classification_invalid",
      message: "Decision approval classification is not supported.",
      nodeId: operation.decision.id
    });
  }

  if (!classification.rationale.trim()) {
    errors.push({
      code: "decision_approval_classification_rationale_required",
      message: "Decision approval classification requires a non-empty rationale.",
      nodeId: operation.decision.id
    });
  }

  if (operation.decision.status === "accepted" && classification.category === "none") {
    errors.push({
      code: "decision_approval_classification_required",
      message: "Accepted Decision proposals require a commitment-changing approval classification.",
      nodeId: operation.decision.id
    });
  }

  return errors;
}

function validateRequiredProvenance(node: PlanningNode): readonly GraphOperationFinding[] {
  const provenance = node.provenance;
  if (!provenance) {
    return [
      {
        code: "graph_operation_provenance_required",
        message: `Generated or inferred ${nodeLabel(node)} proposals require provenance.`,
        nodeId: node.id
      }
    ];
  }

  const missing = provenanceFields(provenance).filter((field) => !field.value.trim()).map((field) => field.name);
  if (missing.length === 0 && ["low", "medium", "high"].includes(provenance.confidence)) {
    return [];
  }

  const errors: GraphOperationFinding[] = [];
  if (missing.length > 0) {
    errors.push({
      code: "graph_operation_provenance_incomplete",
      message: `Provenance must include non-empty ${missing.join(", ")}.`,
      nodeId: node.id
    });
  }

  if (!["low", "medium", "high"].includes(provenance.confidence)) {
    errors.push({
      code: "graph_operation_provenance_confidence_invalid",
      message: "Provenance confidence must be low, medium, or high.",
      nodeId: node.id
    });
  }

  return errors;
}

function validateRequiredProvenanceForOperation(
  provenance: Provenance | undefined,
  nodeId: string
): readonly GraphOperationFinding[] {
  if (!provenance) {
    return [
      {
        code: "graph_operation_provenance_required",
        message: "Generated or inferred Work Item execution-state proposals require provenance.",
        nodeId
      }
    ];
  }

  const missing = provenanceFields(provenance).filter((field) => !field.value.trim()).map((field) => field.name);
  if (missing.length === 0 && ["low", "medium", "high"].includes(provenance.confidence)) {
    return [];
  }

  const errors: GraphOperationFinding[] = [];
  if (missing.length > 0) {
    errors.push({
      code: "graph_operation_provenance_incomplete",
      message: `Provenance must include non-empty ${missing.join(", ")}.`,
      nodeId
    });
  }

  if (!["low", "medium", "high"].includes(provenance.confidence)) {
    errors.push({
      code: "graph_operation_provenance_confidence_invalid",
      message: "Provenance confidence must be low, medium, or high.",
      nodeId
    });
  }

  return errors;
}

function addNodeToCandidateGraph(candidateGraph: PlanningGraph, node: PlanningNode): PlanningGraph {
  return {
    ...candidateGraph,
    graphVersion: graphVersion(Number(candidateGraph.graphVersion) + 1),
    nodes: [...candidateGraph.nodes, node]
  };
}

function addWorkItemToCandidateGraph(candidateGraph: PlanningGraph, operation: AddWorkItemGraphOperation): PlanningGraph {
  const nextVersion = graphVersion(Number(candidateGraph.graphVersion) + 1);
  const workItemWithoutAssertedReadiness: WorkItemNode = {
    ...operation.workItem,
    readinessSnapshot: {
      graphVersion: nextVersion,
      labels: ["agent_eligible"],
      reasons: ["Readiness is derived during candidate graph application."]
    }
  };
  const nextGraph: PlanningGraph = {
    ...candidateGraph,
    graphVersion: nextVersion,
    nodes: [...candidateGraph.nodes, workItemWithoutAssertedReadiness],
    edges: appendNewEdges(candidateGraph.edges, operation.edges)
  };
  const validation = validatePlanningGraph(nextGraph);
  const derivedReadiness =
    validation.readinessSnapshots[workItemWithoutAssertedReadiness.id] ??
    deriveReadinessSnapshot(nextGraph, workItemWithoutAssertedReadiness);

  return {
    ...nextGraph,
    nodes: nextGraph.nodes.map((node) =>
      node.id === workItemWithoutAssertedReadiness.id && node.kind === "work_item"
        ? { ...node, readinessSnapshot: derivedReadiness }
        : node
    )
  };
}

function addDependencyEdgeToCandidateGraph(
  candidateGraph: PlanningGraph,
  operation: AddDependencyEdgeGraphOperation
): PlanningGraph {
  const nextVersion = graphVersion(Number(candidateGraph.graphVersion) + 1);
  return withDerivedReadiness({
    ...candidateGraph,
    graphVersion: nextVersion,
    edges: appendNewEdges(candidateGraph.edges, [operation.edge])
  });
}

function addHitlGateToCandidateGraph(candidateGraph: PlanningGraph, operation: AddHitlGateGraphOperation): PlanningGraph {
  const nextVersion = graphVersion(Number(candidateGraph.graphVersion) + 1);
  return withDerivedReadiness({
    ...candidateGraph,
    graphVersion: nextVersion,
    nodes: [...candidateGraph.nodes, operation.hitlGate],
    edges: appendNewEdges(candidateGraph.edges, operation.edges)
  });
}

function updateWorkItemExecutionStateOnCandidateGraph(
  candidateGraph: PlanningGraph,
  operation: UpdateWorkItemExecutionStateGraphOperation
): PlanningGraph {
  const nextVersion = graphVersion(Number(candidateGraph.graphVersion) + 1);

  return withDerivedReadiness({
    ...candidateGraph,
    graphVersion: nextVersion,
    nodes: candidateGraph.nodes.map((node) =>
      isWorkItem(node) && node.id === operation.workItemId
        ? {
            ...node,
            executionState: operation.executionState
          }
        : node
    )
  });
}

function withDerivedReadiness(graph: PlanningGraph): PlanningGraph {
  const validation = validatePlanningGraph(graph);

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      isWorkItem(node)
        ? {
            ...node,
            readinessSnapshot: validation.readinessSnapshots[node.id] ?? deriveReadinessSnapshot(graph, node)
          }
        : node
    )
  };
}

function appendNewEdges(
  existingEdges: readonly DependencyEdge[],
  proposedEdges: readonly DependencyEdge[]
): readonly DependencyEdge[] {
  const edgeKeys = new Set(existingEdges.map(edgeKey));
  const nextEdges = [...existingEdges];
  for (const edge of proposedEdges) {
    const key = edgeKey(edge);
    if (!edgeKeys.has(key)) {
      nextEdges.push(edge);
      edgeKeys.add(key);
    }
  }

  return nextEdges;
}

function edgeKey(edge: DependencyEdge): string {
  return `${edge.source}\u0000${edge.type}\u0000${edge.target}\u0000${edge.rationale}`;
}

function approvalNotRequired(): GraphOperationApprovalSummary {
  return {
    required: false,
    category: "none",
    rationale: "Operation does not change a planning commitment."
  };
}

function decisionApprovalSummary(operation: AddDecisionGraphOperation): GraphOperationApprovalSummary {
  const category = operation.decision.status === "accepted" ? "commitment_changing" : (operation.approvalClassification?.category ?? "none");
  if (category === "none") {
    return approvalNotRequired();
  }

  return {
    required: true,
    category,
    rationale: operation.approvalClassification?.rationale ?? "Accepted Decision changes planning commitments."
  };
}

function nodeLabel(node: PlanningNode): string {
  if (node.kind === "open_question") {
    return "Open Question";
  }

  if (node.kind === "requirement") {
    return "Requirement";
  }

  if (node.kind === "decision") {
    return "Decision";
  }

  if (node.kind === "work_item") {
    return "Work Item";
  }

  if (node.kind === "hitl_gate") {
    return "HITL Gate";
  }

  return node.kind.replace("_", " ");
}

function isRequirementOrAcceptedDecision(node: PlanningNode | undefined): boolean {
  return node?.kind === "requirement" || (node?.kind === "decision" && node.status === "accepted");
}

function isWorkItem(node: PlanningNode | undefined): node is WorkItemNode {
  return node?.kind === "work_item";
}

function provenanceFields(provenance: Provenance): readonly { readonly name: string; readonly value: string }[] {
  return [
    { name: "sourceType", value: provenance.sourceType },
    { name: "sourceReference", value: provenance.sourceReference },
    { name: "createdBy", value: provenance.createdBy }
  ];
}

function deepClonePlanningGraph(graph: PlanningGraph): PlanningGraph {
  return structuredClone(graph) as PlanningGraph;
}

function deepCloneGraphOperation(operation: ProposedGraphOperation): ProposedGraphOperation {
  return structuredClone(operation) as ProposedGraphOperation;
}

const approvalCategories: readonly GraphOperationApprovalCategory[] = [
  "none",
  "commitment_changing",
  "scope_changing",
  "architecture_changing",
  "risk_changing",
  "readiness_changing",
  "safety_relevant"
];
