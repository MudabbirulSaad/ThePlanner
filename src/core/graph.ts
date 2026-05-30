export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type RequirementId = Brand<`req-${string}`, "RequirementId">;
export type DecisionId = Brand<`dec-${string}`, "DecisionId">;
export type AssumptionId = Brand<`asm-${string}`, "AssumptionId">;
export type RiskId = Brand<`risk-${string}`, "RiskId">;
export type OpenQuestionId = Brand<`oq-${string}`, "OpenQuestionId">;
export type HitlGateId = Brand<`hitl-${string}`, "HitlGateId">;
export type ComponentId = Brand<`comp-${string}`, "ComponentId">;
export type WorkItemId = Brand<`wi-${string}`, "WorkItemId">;
export type DocumentProjectionId = Brand<`doc-${string}`, "DocumentProjectionId">;
export type ExecutionSliceId = Brand<`slice-${string}`, "ExecutionSliceId">;

export type PlanningNodeId =
  | RequirementId
  | DecisionId
  | AssumptionId
  | RiskId
  | OpenQuestionId
  | HitlGateId
  | ComponentId
  | WorkItemId
  | DocumentProjectionId
  | ExecutionSliceId;

export type GraphVersion = Brand<number, "GraphVersion">;
export const supportedPlanningGraphSchemaVersions = ["0.1.0"] as const;
export const currentPlanningGraphSchemaVersion = supportedPlanningGraphSchemaVersions[0];

export type PlanningGraphSchemaVersion = (typeof supportedPlanningGraphSchemaVersions)[number];

export type ProvenanceSourceType =
  | "user_answer"
  | "planner_inference"
  | "repo_scan"
  | "adr"
  | "document_projection"
  | "manual_edit";

export type ProvenanceConfidence = "low" | "medium" | "high";

export interface Provenance {
  readonly sourceType: ProvenanceSourceType;
  readonly sourceReference: string;
  readonly createdBy: string;
  readonly confidence: ProvenanceConfidence;
}

export interface ArchivedNodeMetadata {
  readonly archivedAt: string;
  readonly archivedBy: string;
  readonly reason: string;
  readonly supersededBy?: PlanningNodeId;
}

export interface PlanningNodeBase<TKind extends PlanningNodeKind, TId extends PlanningNodeId> {
  readonly id: TId;
  readonly kind: TKind;
  readonly title: string;
  readonly status:
    | "active"
    | "planned"
    | "accepted"
    | "resolved"
    | "archived"
    | "proposed"
    | "revisit"
    | "done";
  readonly provenance?: Provenance;
  readonly archived?: ArchivedNodeMetadata;
}

export type PlanningNodeKind =
  | "requirement"
  | "decision"
  | "assumption"
  | "risk"
  | "open_question"
  | "hitl_gate"
  | "component"
  | "work_item"
  | "document_projection"
  | "execution_slice";

export interface RequirementNode extends PlanningNodeBase<"requirement", RequirementId> {
  readonly requirementType: "functional" | "non_functional" | "constraint";
  readonly statement: string;
}

export interface DecisionNode extends PlanningNodeBase<"decision", DecisionId> {
  readonly selectedOption: string;
  readonly rationale: string;
  readonly rejectedAlternatives: readonly string[];
  readonly unresolvedQuestions: readonly string[];
}

export interface AssumptionNode extends PlanningNodeBase<"assumption", AssumptionId> {
  readonly statement: string;
  readonly confidence: ProvenanceConfidence;
  readonly impactIfWrong: string;
  readonly blocksAfk: boolean;
}

export interface RiskNode extends PlanningNodeBase<"risk", RiskId> {
  readonly likelihood: "low" | "medium" | "high";
  readonly impact: "low" | "medium" | "high";
  readonly mitigation: string;
  readonly blocksAfk: boolean;
}

export interface OpenQuestionNode extends PlanningNodeBase<"open_question", OpenQuestionId> {
  readonly question: string;
  readonly priority: "low" | "medium" | "high";
  readonly blocksExecution: boolean;
}

export interface HitlGateNode extends PlanningNodeBase<"hitl_gate", HitlGateId> {
  readonly requiredAction: string;
  readonly blocks: readonly WorkItemId[];
  readonly resolvedAt?: string;
  readonly resolution?: string;
}

export interface ComponentInterface {
  readonly name: string;
  readonly direction: "inbound" | "outbound" | "internal";
  readonly contract: string;
}

export interface ComponentNode extends PlanningNodeBase<"component", ComponentId> {
  readonly responsibility: string;
  readonly interfaces: readonly ComponentInterface[];
  readonly dependsOn: readonly ComponentId[];
  readonly constraints: readonly string[];
  readonly risks: readonly string[];
}

export type ExecutionState =
  | "backlog"
  | "ready"
  | "in_progress"
  | "review"
  | "done"
  | "cancelled"
  | "deferred";

export type ReadinessLabel =
  | "human_only"
  | "agent_eligible"
  | "afk_ready"
  | "hitl_gated"
  | "blocked";

export interface ReadinessSnapshot {
  readonly graphVersion: GraphVersion;
  readonly labels: readonly ReadinessLabel[];
  readonly reasons: readonly string[];
  readonly computedAt?: string;
}

export interface ValidationMethod {
  readonly type: "command" | "test" | "manual_review";
  readonly command?: string;
  readonly expectedResult: string;
}

export interface WorkItemNode extends PlanningNodeBase<"work_item", WorkItemId> {
  readonly executionState: ExecutionState;
  readonly readinessSnapshot: ReadinessSnapshot;
  readonly acceptanceCriteria: readonly string[];
  readonly validationMethods: readonly ValidationMethod[];
}

export interface DocumentProjectionNode
  extends PlanningNodeBase<"document_projection", DocumentProjectionId> {
  readonly path: string;
  readonly projectionType: "prd" | "rfc" | "architecture" | "dependency_view" | "work_item";
}

export interface ExecutionSliceNode extends PlanningNodeBase<"execution_slice", ExecutionSliceId> {
  readonly workItems: readonly WorkItemId[];
  readonly readinessSummary: string;
}

export type PlanningNode =
  | RequirementNode
  | DecisionNode
  | AssumptionNode
  | RiskNode
  | OpenQuestionNode
  | HitlGateNode
  | ComponentNode
  | WorkItemNode
  | DocumentProjectionNode
  | ExecutionSliceNode;

export type DependencyEdgeType =
  | "depends_on"
  | "blocks"
  | "satisfies"
  | "mitigates"
  | "raises"
  | "references"
  | "supersedes";

export interface DependencyEdge {
  readonly source: PlanningNodeId;
  readonly target: PlanningNodeId;
  readonly type: DependencyEdgeType;
  readonly rationale: string;
}

export interface ProductIntent {
  readonly summary: string;
  readonly targetUsers: readonly string[];
  readonly goals: readonly string[];
  readonly mvpScope: readonly string[];
  readonly nonGoals: readonly string[];
  readonly constraints: readonly string[];
  readonly successCriteria: readonly string[];
  readonly scaffoldNotes: readonly string[];
  readonly provenance?: Provenance;
}

export interface PlanningGraph {
  readonly schemaVersion: string;
  readonly graphVersion: GraphVersion;
  readonly generatedAt?: string;
  readonly source?: string;
  readonly productIntent?: ProductIntent;
  readonly nodes: readonly PlanningNode[];
  readonly edges: readonly DependencyEdge[];
}

export function isSupportedPlanningGraphSchemaVersion(value: string): value is PlanningGraphSchemaVersion {
  return supportedPlanningGraphSchemaVersions.some((version) => version === value);
}

export function graphVersion(value: number): GraphVersion {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`GraphVersion must be a positive integer: ${value}`);
  }

  return value as GraphVersion;
}

export function stableId<TId extends PlanningNodeId>(value: string, prefix: string): TId {
  if (!new RegExp(`^${prefix}-[0-9]{3}$`).test(value)) {
    throw new Error(`Stable Graph ID must match ${prefix}-NNN: ${value}`);
  }

  return value as TId;
}
