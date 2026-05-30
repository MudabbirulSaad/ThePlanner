import type { OpenQuestionNode, PlanningGraph, PlanningNode, Provenance } from "./graph.js";
import { graphVersion, stableId } from "./graph.js";

export type ProposedGraphOperation = AddOpenQuestionGraphOperation;

export interface AddOpenQuestionGraphOperation {
  readonly kind: "AddOpenQuestion";
  readonly openQuestion: OpenQuestionNode;
}

export interface GraphOperationFinding {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
}

export type GraphOperationApplyResult =
  | {
      readonly status: "applied";
      readonly candidateGraph: PlanningGraph;
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
      candidateGraph: {
        ...candidateGraph,
        graphVersion: graphVersion(Number(candidateGraph.graphVersion) + 1),
        nodes: [...candidateGraph.nodes, operationClone.openQuestion]
      }
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

function validateRequiredProvenance(node: PlanningNode): readonly GraphOperationFinding[] {
  const provenance = node.provenance;
  if (!provenance) {
    return [
      {
        code: "graph_operation_provenance_required",
        message: "Generated or inferred Open Question proposals require provenance.",
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
