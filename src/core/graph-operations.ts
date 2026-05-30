import type { DecisionNode, OpenQuestionNode, PlanningGraph, PlanningNode, Provenance, RequirementNode } from "./graph.js";
import { graphVersion, stableId } from "./graph.js";

export type ProposedGraphOperation = AddOpenQuestionGraphOperation | AddRequirementGraphOperation | AddDecisionGraphOperation;

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

function validateNodeId(
  graph: PlanningGraph,
  node: PlanningNode,
  prefix: "req" | "dec" | "oq",
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

function addNodeToCandidateGraph(candidateGraph: PlanningGraph, node: PlanningNode): PlanningGraph {
  return {
    ...candidateGraph,
    graphVersion: graphVersion(Number(candidateGraph.graphVersion) + 1),
    nodes: [...candidateGraph.nodes, node]
  };
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

  return node.kind.replace("_", " ");
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
