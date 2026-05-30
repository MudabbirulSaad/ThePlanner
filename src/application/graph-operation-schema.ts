import { z } from "zod";

import type {
  DecisionNode,
  DependencyEdge,
  ExecutionState,
  GraphOperationApprovalCategory,
  HitlGateNode,
  OpenQuestionNode,
  ProposedGraphOperation,
  Provenance,
  RequirementNode,
  WorkItemNode
} from "../core/index.js";

export interface ParsedGraphOperationProposalInput {
  readonly operation: ProposedGraphOperation;
  readonly approved: boolean;
}

const operationNameSchema = z.object({
  operation: z.string()
});

const provenanceSchema = z
  .object({
    source_type: z.enum([
      "user_answer",
      "planner_inference",
      "repo_scan",
      "adr",
      "document_projection",
      "manual_edit"
    ]),
    source_reference: z.string(),
    created_by: z.string(),
    confidence: z.enum(["low", "medium", "high"])
  })
  .strict()
  .transform(
    (value): Provenance => ({
      sourceType: value.source_type,
      sourceReference: value.source_reference,
      createdBy: value.created_by,
      confidence: value.confidence
    })
  );

const dependencyEdgeSchema = z
  .object({
    source: z.string(),
    target: z.string(),
    type: z.enum(["depends_on", "blocks", "satisfies", "mitigates", "raises", "references", "supersedes"]),
    rationale: z.string()
  })
  .strict()
  .transform(
    (value): DependencyEdge => ({
      source: value.source as DependencyEdge["source"],
      target: value.target as DependencyEdge["target"],
      type: value.type,
      rationale: value.rationale
    })
  );

const approvalClassificationSchema = z
  .object({
    category: z.enum([
      "none",
      "commitment_changing",
      "scope_changing",
      "architecture_changing",
      "risk_changing",
      "readiness_changing",
      "safety_relevant"
    ]),
    rationale: z.string()
  })
  .strict()
  .transform((value) => ({
    category: value.category as GraphOperationApprovalCategory,
    rationale: value.rationale
  }));

const openQuestionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    question: z.string(),
    priority: z.enum(["low", "medium", "high"]),
    blocks_execution: z.boolean(),
    provenance: provenanceSchema.optional()
  })
  .strict()
  .transform(
    (value): OpenQuestionNode => ({
      id: value.id as OpenQuestionNode["id"],
      kind: "open_question",
      title: value.title,
      status: "active",
      question: value.question,
      priority: value.priority,
      blocksExecution: value.blocks_execution,
      ...(value.provenance ? { provenance: value.provenance } : {})
    })
  );

const requirementSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["active", "planned"]).default("active"),
    type: z.enum(["functional", "non_functional", "constraint"]),
    statement: z.string(),
    provenance: provenanceSchema.optional()
  })
  .strict()
  .transform(
    (value): RequirementNode => ({
      id: value.id as RequirementNode["id"],
      kind: "requirement",
      title: value.title,
      status: value.status,
      requirementType: value.type,
      statement: value.statement,
      ...(value.provenance ? { provenance: value.provenance } : {})
    })
  );

const decisionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["accepted", "proposed", "revisit"]).default("proposed"),
    selected_option: z.string(),
    rationale: z.string(),
    rejected_alternatives: z.array(z.string()).default([]),
    unresolved_questions: z.array(z.string()).default([]),
    provenance: provenanceSchema.optional()
  })
  .strict()
  .transform(
    (value): DecisionNode => ({
      id: value.id as DecisionNode["id"],
      kind: "decision",
      title: value.title,
      status: value.status,
      selectedOption: value.selected_option,
      rationale: value.rationale,
      rejectedAlternatives: value.rejected_alternatives,
      unresolvedQuestions: value.unresolved_questions,
      ...(value.provenance ? { provenance: value.provenance } : {})
    })
  );

const validationMethodSchema = z
  .object({
    type: z.enum(["command", "test", "manual_review"]),
    command: z.string().optional(),
    expected_result: z.string()
  })
  .strict()
  .transform((value) => ({
    type: value.type,
    ...(value.command === undefined ? {} : { command: value.command }),
    expectedResult: value.expected_result
  }));

const workItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["planned", "active", "done", "archived"]).default("planned"),
    execution_state: z
      .enum(["backlog", "ready", "in_progress", "review", "done", "cancelled", "deferred"])
      .default("backlog"),
    context_summary: z.string().optional(),
    boundary_notes: z.array(z.string()).default([]),
    acceptance_criteria: z.array(z.string()).default([]),
    validation_methods: z.array(validationMethodSchema).default([]),
    safe_failure_guidance: z.string().optional(),
    provenance: provenanceSchema.optional()
  })
  .strict()
  .transform(
    (value): WorkItemNode => ({
      id: value.id as WorkItemNode["id"],
      kind: "work_item",
      title: value.title,
      status: value.status,
      executionState: value.execution_state,
      readinessSnapshot: {
        graphVersion: 1 as WorkItemNode["readinessSnapshot"]["graphVersion"],
        labels: ["agent_eligible"],
        reasons: ["Readiness is derived during candidate graph application."]
      },
      ...(value.context_summary === undefined ? {} : { contextSummary: value.context_summary }),
      boundaryNotes: value.boundary_notes,
      acceptanceCriteria: value.acceptance_criteria,
      validationMethods: value.validation_methods,
      ...(value.safe_failure_guidance === undefined
        ? {}
        : { safeFailureGuidance: value.safe_failure_guidance }),
      ...(value.provenance ? { provenance: value.provenance } : {})
    })
  );

const hitlGateSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["active", "accepted", "resolved", "planned"]).default("active"),
    required_action: z.string(),
    blocks: z.array(z.string()).default([]),
    resolved_at: z.string().optional(),
    resolution: z.string().optional(),
    provenance: provenanceSchema.optional()
  })
  .strict()
  .transform(
    (value): HitlGateNode => ({
      id: value.id as HitlGateNode["id"],
      kind: "hitl_gate",
      title: value.title,
      status: value.status,
      requiredAction: value.required_action,
      blocks: value.blocks as unknown as HitlGateNode["blocks"],
      ...(value.resolved_at === undefined ? {} : { resolvedAt: value.resolved_at }),
      ...(value.resolution === undefined ? {} : { resolution: value.resolution }),
      ...(value.provenance ? { provenance: value.provenance } : {})
    })
  );

const addOpenQuestionOperationSchema = z
  .object({
    operation: z.enum(["add_open_question", "AddOpenQuestion"]),
    open_question: openQuestionSchema
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddOpenQuestion",
      openQuestion: value.open_question
    })
  );

const addRequirementOperationSchema = z
  .object({
    operation: z.enum(["add_requirement", "AddRequirement"]),
    requirement: requirementSchema
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddRequirement",
      requirement: value.requirement
    })
  );

const addDecisionOperationSchema = z
  .object({
    operation: z.enum(["add_decision", "AddDecision"]),
    decision: decisionSchema,
    approval_classification: approvalClassificationSchema.optional()
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddDecision",
      decision: value.decision,
      ...(value.approval_classification
        ? { approvalClassification: value.approval_classification }
        : {})
    })
  );

const addWorkItemOperationSchema = z
  .object({
    operation: z.enum(["add_work_item", "AddWorkItem"]),
    work_item: workItemSchema,
    edges: z.array(dependencyEdgeSchema).default([])
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddWorkItem",
      workItem: value.work_item,
      edges: value.edges
    })
  );

const addDependencyEdgeOperationSchema = z
  .object({
    operation: z.enum(["add_dependency_edge", "AddDependencyEdge"]),
    edge: dependencyEdgeSchema
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddDependencyEdge",
      edge: value.edge
    })
  );

const addHitlGateOperationSchema = z
  .object({
    operation: z.enum(["add_hitl_gate", "AddHitlGate"]),
    hitl_gate: hitlGateSchema,
    edges: z.array(dependencyEdgeSchema).default([])
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "AddHitlGate",
      hitlGate: value.hitl_gate,
      edges: value.edges
    })
  );

const updateWorkItemExecutionStateOperationSchema = z
  .object({
    operation: z.enum(["update_work_item_execution_state", "UpdateWorkItemExecutionState"]),
    work_item_id: z.string(),
    execution_state: z.enum(["backlog", "ready", "in_progress", "review", "done", "cancelled", "deferred"]),
    rationale: z.string(),
    provenance: provenanceSchema
  })
  .strict()
  .transform(
    (value): ProposedGraphOperation => ({
      kind: "UpdateWorkItemExecutionState",
      workItemId: value.work_item_id as WorkItemNode["id"],
      executionState: value.execution_state as ExecutionState,
      rationale: value.rationale,
      provenance: value.provenance
    })
  );

const operationSchemaByName: Record<string, z.ZodType<ProposedGraphOperation>> = {
  add_open_question: addOpenQuestionOperationSchema,
  AddOpenQuestion: addOpenQuestionOperationSchema,
  add_requirement: addRequirementOperationSchema,
  AddRequirement: addRequirementOperationSchema,
  add_decision: addDecisionOperationSchema,
  AddDecision: addDecisionOperationSchema,
  add_work_item: addWorkItemOperationSchema,
  AddWorkItem: addWorkItemOperationSchema,
  add_dependency_edge: addDependencyEdgeOperationSchema,
  AddDependencyEdge: addDependencyEdgeOperationSchema,
  add_hitl_gate: addHitlGateOperationSchema,
  AddHitlGate: addHitlGateOperationSchema,
  update_work_item_execution_state: updateWorkItemExecutionStateOperationSchema,
  UpdateWorkItemExecutionState: updateWorkItemExecutionStateOperationSchema
} satisfies Record<string, z.ZodType<ProposedGraphOperation>>;

const supportedOperationNames = Object.keys(operationSchemaByName).sort();

export function parseProposedGraphOperationJson(value: unknown): ProposedGraphOperation {
  const nameResult = operationNameSchema.safeParse(value);
  if (!nameResult.success) {
    throw new Error(formatZodError("Proposed Graph Operation", nameResult.error));
  }

  const schema = operationSchemaByName[nameResult.data.operation];
  if (!schema) {
    throw new Error(
      `Unsupported Proposed Graph Operation: ${nameResult.data.operation}. Supported operations: ${supportedOperationNames.join(", ")}.`
    );
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(formatZodError("Proposed Graph Operation", result.error));
  }

  return result.data;
}

export function parseProposedGraphOperationProposalJson(
  value: unknown
): ParsedGraphOperationProposalInput {
  const proposal = parseProposalObject(value);
  const { approved: _approved, ...operationInput } = proposal;

  return {
    operation: parseProposedGraphOperationJson(operationInput),
    approved: proposal.approved === true
  };
}

function parseProposalObject(value: unknown): Record<string, unknown> & { readonly approved?: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Proposed Graph Operation must be an object.");
  }

  return value as Record<string, unknown> & { readonly approved?: unknown };
}

function formatZodError(label: string, error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length === 0 ? label : `${label}.${issue.path.join(".")}`;
    return `${path}: ${issue.message}`;
  });

  return `${label} failed schema validation: ${issues.join("; ")}`;
}
