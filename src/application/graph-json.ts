import type {
  AssumptionNode,
  ComponentNode,
  DecisionNode,
  DependencyEdge,
  DocumentProjectionNode,
  ExecutionSliceNode,
  HitlGateNode,
  OpenQuestionNode,
  PlanningGraph,
  PlanningNode,
  RequirementNode,
  RiskNode,
  ValidationMethod,
  WorkItemNode
} from "../core/index.js";
import { graphVersion } from "../core/index.js";

type RawGraph = {
  schema_version: string;
  graph_version: number;
  generated_at?: string;
  source?: string;
  nodes: {
    requirements?: RawNode[];
    decisions?: RawNode[];
    assumptions?: RawNode[];
    risks?: RawNode[];
    open_questions?: RawNode[];
    hitl_gates?: RawNode[];
    components?: RawNode[];
    work_items?: RawNode[];
    document_projections?: RawNode[];
    execution_slices?: RawNode[];
  };
  edges?: RawEdge[];
};

type RawNode = Record<string, unknown>;
type RawEdge = { source: string; target: string; type: DependencyEdge["type"]; rationale?: string };

export function parsePlanningGraphJson(value: unknown): PlanningGraph {
  const raw = value as RawGraph;
  const version = graphVersion(raw.graph_version);

  return {
    schemaVersion: raw.schema_version,
    graphVersion: version,
    generatedAt: raw.generated_at,
    source: raw.source,
    nodes: [
      ...(raw.nodes.requirements ?? []).map((node) => ({
        id: text(node.id),
        kind: "requirement",
        title: text(node.title),
        status: text(node.status),
        requirementType: text(node.type),
        statement: text(node.statement),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.decisions ?? []).map((node) => ({
        id: text(node.id),
        kind: "decision",
        title: text(node.title),
        status: text(node.status),
        selectedOption: text(node.selected_option),
        rationale: text(node.rationale),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.assumptions ?? []).map((node) => ({
        id: text(node.id),
        kind: "assumption",
        title: text(node.title),
        status: "active",
        statement: text(node.statement),
        confidence: text(node.confidence),
        impactIfWrong: text(node.impact_if_wrong),
        blocksAfk: Boolean(node.blocks_afk),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.risks ?? []).map((node) => ({
        id: text(node.id),
        kind: "risk",
        title: text(node.title),
        status: "active",
        likelihood: text(node.likelihood),
        impact: text(node.impact),
        mitigation: text(node.mitigation),
        blocksAfk: Boolean(node.blocks_afk),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.open_questions ?? []).map((node) => ({
        id: text(node.id),
        kind: "open_question",
        title: text(node.title),
        status: "active",
        question: text(node.question),
        priority: text(node.priority),
        blocksExecution: Boolean(node.blocks_execution),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.hitl_gates ?? []).map((node) => ({
        id: text(node.id),
        kind: "hitl_gate",
        title: text(node.title),
        status: text(node.status ?? "active"),
        requiredAction: text(node.required_action),
        blocks: strings(node.blocks),
        resolvedAt: optionalText(node.resolved_at),
        resolution: optionalText(node.resolution),
        provenance: provenance(node.provenance)
      })),
      ...(raw.nodes.components ?? []).map((node) => ({
        id: text(node.id),
        kind: "component",
        title: text(node.title),
        status: text(node.status),
        responsibility: text(node.responsibility)
      })),
      ...(raw.nodes.work_items ?? []).map((node) => ({
        id: text(node.id),
        kind: "work_item",
        title: text(node.title),
        status: "planned",
        executionState: text(node.execution_state),
        readinessSnapshot: {
          graphVersion: version,
          labels: strings(record(node.readiness_snapshot).labels),
          reasons: strings(record(node.readiness_snapshot).reasons)
        },
        acceptanceCriteria: strings(node.acceptance_criteria),
        validationMethods: validationMethods(node.validation_methods)
      })),
      ...(raw.nodes.document_projections ?? []).map((node) => ({
        id: text(node.id),
        kind: "document_projection",
        title: text(node.title),
        status: "active",
        path: text(node.path),
        projectionType: text(node.projection_type)
      })),
      ...(raw.nodes.execution_slices ?? []).map((node) => ({
        id: text(node.id),
        kind: "execution_slice",
        title: text(node.title),
        status: "planned",
        workItems: strings(node.work_items),
        readinessSummary: text(node.readiness_summary)
      }))
    ] as unknown as readonly PlanningNode[],
    edges: (raw.edges ?? []).map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      rationale: edge.rationale ?? ""
    })) as unknown as readonly DependencyEdge[]
  };
}

export function serializePlanningGraphJson(graph: PlanningGraph): unknown {
  return {
    schema_version: graph.schemaVersion,
    graph_version: graph.graphVersion,
    generated_at: graph.generatedAt,
    source: graph.source,
    nodes: {
      requirements: graph.nodes.filter(isRequirement).map((node) => ({
        id: node.id,
        title: node.title,
        type: node.requirementType,
        statement: node.statement,
        status: node.status,
        provenance: serializeProvenance(node.provenance)
      })),
      decisions: graph.nodes.filter(isDecision).map((node) => ({
        id: node.id,
        title: node.title,
        status: node.status,
        selected_option: node.selectedOption,
        rationale: node.rationale,
        provenance: serializeProvenance(node.provenance)
      })),
      assumptions: graph.nodes.filter(isAssumption).map((node) => ({
        id: node.id,
        title: node.title,
        statement: node.statement,
        confidence: node.confidence,
        impact_if_wrong: node.impactIfWrong,
        blocks_afk: node.blocksAfk,
        provenance: serializeProvenance(node.provenance)
      })),
      risks: graph.nodes.filter(isRisk).map((node) => ({
        id: node.id,
        title: node.title,
        likelihood: node.likelihood,
        impact: node.impact,
        mitigation: node.mitigation,
        blocks_afk: node.blocksAfk,
        provenance: serializeProvenance(node.provenance)
      })),
      open_questions: graph.nodes.filter(isOpenQuestion).map((node) => ({
        id: node.id,
        title: node.title,
        question: node.question,
        priority: node.priority,
        blocks_execution: node.blocksExecution,
        provenance: serializeProvenance(node.provenance)
      })),
      hitl_gates: graph.nodes.filter(isHitlGate).map((node) => ({
        id: node.id,
        title: node.title,
        required_action: node.requiredAction,
        blocks: node.blocks,
        provenance: serializeProvenance(node.provenance),
        status: node.status,
        resolved_at: node.resolvedAt,
        resolution: node.resolution
      })),
      components: graph.nodes.filter(isComponent).map((node) => ({
        id: node.id,
        title: node.title,
        responsibility: node.responsibility,
        status: node.status
      })),
      work_items: graph.nodes.filter(isWorkItem).map((node) => ({
        id: node.id,
        title: node.title,
        execution_state: node.executionState,
        readiness_snapshot: {
          graph_version: node.readinessSnapshot.graphVersion,
          labels: node.readinessSnapshot.labels,
          reasons: node.readinessSnapshot.reasons
        },
        acceptance_criteria: node.acceptanceCriteria,
        validation_methods: node.validationMethods.map((method) => ({
          type: method.type,
          command: method.command,
          expected_result: method.expectedResult
        }))
      })),
      document_projections: graph.nodes.filter(isDocumentProjection).map((node) => ({
        id: node.id,
        title: node.title,
        path: node.path,
        projection_type: node.projectionType
      })),
      execution_slices: graph.nodes.filter(isExecutionSlice).map((node) => ({
        id: node.id,
        title: node.title,
        work_items: node.workItems,
        readiness_summary: node.readinessSummary
      }))
    },
    edges: graph.edges
  };
}

function validationMethods(value: unknown): readonly ValidationMethod[] {
  return array(value).map((item) => {
    const method = record(item);
    return {
      type: text(method.type),
      command: optionalText(method.command),
      expectedResult: text(method.expected_result)
    } as ValidationMethod;
  });
}

function provenance(value: unknown) {
  if (!value) {
    return undefined;
  }

  const raw = record(value);
  return {
    sourceType: text(raw.source_type),
    sourceReference: text(raw.source_reference),
    createdBy: text(raw.created_by),
    confidence: text(raw.confidence)
  };
}

function serializeProvenance(value: PlanningNode["provenance"]) {
  if (!value) {
    return undefined;
  }

  return {
    source_type: value.sourceType,
    source_reference: value.sourceReference,
    created_by: value.createdBy,
    confidence: value.confidence
  };
}

function isRequirement(node: PlanningNode): node is RequirementNode {
  return node.kind === "requirement";
}

function isDecision(node: PlanningNode): node is DecisionNode {
  return node.kind === "decision";
}

function isAssumption(node: PlanningNode): node is AssumptionNode {
  return node.kind === "assumption";
}

function isRisk(node: PlanningNode): node is RiskNode {
  return node.kind === "risk";
}

function isOpenQuestion(node: PlanningNode): node is OpenQuestionNode {
  return node.kind === "open_question";
}

function isHitlGate(node: PlanningNode): node is HitlGateNode {
  return node.kind === "hitl_gate";
}

function isComponent(node: PlanningNode): node is ComponentNode {
  return node.kind === "component";
}

function isWorkItem(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item";
}

function isDocumentProjection(node: PlanningNode): node is DocumentProjectionNode {
  return node.kind === "document_projection";
}

function isExecutionSlice(node: PlanningNode): node is ExecutionSliceNode {
  return node.kind === "execution_slice";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function strings(value: unknown): readonly string[] {
  return array(value).map(text);
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
