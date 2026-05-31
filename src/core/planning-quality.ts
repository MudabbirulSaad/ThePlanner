import type {
  ComponentNode,
  DecisionNode,
  PlanningGraph,
  PlanningNodeId,
  ProductIntent,
  WorkItemNode
} from "./graph.js";

export type PlanningQualityStatus = "acceptable" | "warning";

export interface PlanningQualityFinding {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: PlanningNodeId;
}

export interface PlanningQualityResult {
  readonly status: PlanningQualityStatus;
  readonly findings: readonly PlanningQualityFinding[];
}

const placeholderPattern = /\b(TODO|TBD|placeholder|fill\s+in|not\s+captured|not\s+specified|to\s+be\s+defined)\b/iu;
const fallbackWorkItemTitles = new Set([
  "Implement the smallest coherent MVP workflow described by the refined brief.",
  "Add deterministic validation for the MVP workflow.",
  "Review the implementation against refined brief constraints."
]);

export function assessPlanningQuality(graph: PlanningGraph): PlanningQualityResult {
  const findings: PlanningQualityFinding[] = [
    ...productIntentFindings(graph.productIntent),
    ...decisionFindings(graph.nodes.filter(isDecision)),
    ...componentFindings(graph.nodes.filter(isComponent)),
    ...workItemFindings(graph.nodes.filter(isWorkItem))
  ];

  return {
    status: findings.length === 0 ? "acceptable" : "warning",
    findings
  };
}

function productIntentFindings(intent: ProductIntent | undefined): readonly PlanningQualityFinding[] {
  if (!intent) {
    return [
      {
        code: "planning_quality_product_intent_missing",
        message: "Product Intent is missing, so exported projections may not explain product scope or intent."
      }
    ];
  }

  const scaffoldedFields = productIntentFieldEntries(intent).filter(([, values]) =>
    values.some(hasPlaceholderText)
  );
  const findings: PlanningQualityFinding[] = [];

  if (intent.scaffoldNotes.length > 0 || scaffoldedFields.length > 0) {
    const fields = scaffoldedFields.map(([field]) => field);
    findings.push({
      code: "planning_quality_product_intent_scaffolded",
      message: `Product Intent contains scaffold placeholders${fields.length > 0 ? ` in ${fields.join(", ")}` : ""}.`
    });
  }

  return findings;
}

function decisionFindings(decisions: readonly DecisionNode[]): readonly PlanningQualityFinding[] {
  if (decisions.length === 0) {
    return [
      {
        code: "planning_quality_decisions_missing",
        message: "No RFC Decisions are captured; architecture-significant choices should be explicit before trusted export."
      }
    ];
  }

  const findings: PlanningQualityFinding[] = [];
  if (!decisions.some((decision) => decision.status === "accepted")) {
    findings.push({
      code: "planning_quality_accepted_decisions_missing",
      message: "No accepted RFC Decisions are captured; trusted execution needs settled architecture choices."
    });
  }

  for (const decision of decisions) {
    if (
      !decision.selectedOption.trim() ||
      !decision.rationale.trim() ||
      hasPlaceholderText(decision.selectedOption) ||
      hasPlaceholderText(decision.rationale)
    ) {
      findings.push({
        code: "planning_quality_decision_scaffolded",
        message: `RFC Decision is empty or scaffolded: ${decision.id}.`,
        nodeId: decision.id
      });
    }
  }

  return findings;
}

function componentFindings(components: readonly ComponentNode[]): readonly PlanningQualityFinding[] {
  return components
    .filter(isGenericComponent)
    .map((component) => ({
      code: "planning_quality_component_generic",
      message: `Component is too generic for trusted execution handoff: ${component.id}.`,
      nodeId: component.id
    }));
}

function workItemFindings(workItems: readonly WorkItemNode[]): readonly PlanningQualityFinding[] {
  return workItems
    .filter(isFallbackWorkItem)
    .map((workItem) => ({
      code: "planning_quality_work_item_fallback",
      message: `Work Item appears to be a fallback scaffold rather than a specific execution slice: ${workItem.id}.`,
      nodeId: workItem.id
    }));
}

function productIntentFieldEntries(intent: ProductIntent): readonly (readonly [string, readonly string[]])[] {
  return [
    ["summary", [intent.summary]],
    ["targetUsers", intent.targetUsers],
    ["goals", intent.goals],
    ["mvpScope", intent.mvpScope],
    ["nonGoals", intent.nonGoals],
    ["constraints", intent.constraints],
    ["successCriteria", intent.successCriteria],
    ["scaffoldNotes", intent.scaffoldNotes]
  ];
}

function isGenericComponent(component: ComponentNode): boolean {
  return (
    hasPlaceholderText(component.title) ||
    hasPlaceholderText(component.responsibility) ||
    /^component(?:\s+\d+)?$/iu.test(component.title.trim()) ||
    /^(core|service|backend|frontend|module|app|application)$/iu.test(component.title.trim()) ||
    /^responsible for (the )?(app|application|system|service)$/iu.test(component.responsibility.trim()) ||
    component.interfaces.length === 0
  );
}

function isFallbackWorkItem(workItem: WorkItemNode): boolean {
  return (
    fallbackWorkItemTitles.has(workItem.title) ||
    hasPlaceholderText(workItem.title) ||
    hasPlaceholderText(workItem.contextSummary ?? "") ||
    workItem.acceptanceCriteria.some(hasPlaceholderText)
  );
}

function hasPlaceholderText(value: string): boolean {
  return placeholderPattern.test(value);
}

function isDecision(node: { readonly kind: string }): node is DecisionNode {
  return node.kind === "decision";
}

function isComponent(node: { readonly kind: string }): node is ComponentNode {
  return node.kind === "component";
}

function isWorkItem(node: { readonly kind: string }): node is WorkItemNode {
  return node.kind === "work_item";
}
