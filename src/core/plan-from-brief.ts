import type {
  ComponentNode,
  DependencyEdge,
  DocumentProjectionNode,
  ExecutionSliceNode,
  OpenQuestionNode,
  PlanningGraph,
  ProductIntent,
  Provenance,
  RequirementNode,
  RiskNode,
  WorkItemNode
} from "./graph.js";
import { currentPlanningGraphSchemaVersion, graphVersion, stableId } from "./graph.js";

export interface PlanFromBriefInput {
  readonly sourcePath: string;
  readonly content: string;
}

export interface GraphProposalFromBrief {
  readonly graph: PlanningGraph;
  readonly scaffoldedFields: readonly string[];
}

type BriefSectionKey =
  | "product_summary"
  | "users"
  | "goals"
  | "mvp_scope"
  | "non_goals"
  | "constraints"
  | "success_criteria"
  | "open_questions"
  | "raw_idea";

type BriefSections = Readonly<Record<BriefSectionKey, readonly string[]>>;

const sectionKeys: Readonly<Record<string, BriefSectionKey>> = {
  "product summary": "product_summary",
  users: "users",
  goals: "goals",
  "mvp scope": "mvp_scope",
  "non-goals": "non_goals",
  "non goals": "non_goals",
  constraints: "constraints",
  "success criteria": "success_criteria",
  "open questions": "open_questions",
  "raw idea": "raw_idea"
};

export function proposePlanningGraphFromBrief(input: PlanFromBriefInput): GraphProposalFromBrief {
  if (!input.content.trim()) {
    throw new Error(`Refined brief is empty: ${input.sourcePath}`);
  }

  const sections = parseBriefSections(input.content);
  const sourceReference = input.sourcePath;
  const provenance: Provenance = {
    sourceType: "planner_inference",
    sourceReference,
    createdBy: "theplanner plan --dry-run",
    confidence: "medium"
  };
  const scaffoldedFields: string[] = [];

  const productIntent = buildProductIntent(sections, provenance, scaffoldedFields);
  const requirements = buildRequirements(sections, provenance, scaffoldedFields);
  const openQuestions = buildOpenQuestions(sections, provenance, scaffoldedFields);
  const risks = buildRisks(sections, provenance, scaffoldedFields);
  const components = buildComponents(sections, scaffoldedFields);
  const workItems = buildWorkItems(requirements, components.length > 0, scaffoldedFields);
  const documents = buildDocumentProjections();
  const slices = buildExecutionSlices(workItems);
  const edges = buildEdges(requirements, risks, components, workItems, documents);

  return {
    graph: {
      schemaVersion: currentPlanningGraphSchemaVersion,
      graphVersion: graphVersion(1),
      source: sourceReference,
      productIntent,
      nodes: [...requirements, ...openQuestions, ...risks, ...components, ...workItems, ...documents, ...slices],
      edges
    },
    scaffoldedFields
  };
}

function parseBriefSections(content: string): BriefSections {
  const buckets: Record<BriefSectionKey, string[]> = {
    product_summary: [],
    users: [],
    goals: [],
    mvp_scope: [],
    non_goals: [],
    constraints: [],
    success_criteria: [],
    open_questions: [],
    raw_idea: []
  };
  let current: BriefSectionKey = "raw_idea";

  for (const line of content.split(/\r?\n/u)) {
    const heading = /^#{2,3}\s+(?<title>.+?)\s*$/u.exec(line)?.groups?.title.toLowerCase();
    if (heading && sectionKeys[heading]) {
      current = sectionKeys[heading];
      continue;
    }

    const normalized = normalizeBriefLine(line);
    if (normalized) {
      buckets[current].push(normalized);
    }
  }

  return buckets;
}

function buildProductIntent(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): ProductIntent {
  const scaffoldNotes: string[] = [];
  const missingSection = (title: string, note: string): void => {
    const message = `Product intent ${title} scaffolded because ${title} was empty.`;
    scaffoldNotes.push(note);
    scaffoldedFields.push(message);
  };

  if (sections.product_summary.length === 0) {
    missingSection("Product Summary", "TODO: Add a concise product summary before rendering the PRD projection.");
  }

  if (sections.users.length === 0) {
    missingSection("Users", "TODO: Identify primary users, secondary users, and users explicitly out of scope.");
  }

  if (sections.goals.length === 0) {
    missingSection("Goals", "TODO: Define the product and user outcomes this plan should achieve.");
  }

  if (sections.mvp_scope.length === 0) {
    missingSection("MVP Scope", "TODO: Define the smallest coherent scope for the first implementation slice.");
  }

  if (sections.non_goals.length === 0) {
    missingSection("Non-Goals", "TODO: List capabilities, audiences, and integrations intentionally deferred.");
  }

  if (sections.constraints.length === 0) {
    missingSection("Constraints", "TODO: Capture technical, operational, legal, team, and timeline constraints.");
  }

  if (sections.success_criteria.length === 0) {
    missingSection("Success Criteria", "TODO: Add measurable signals that prove the MVP solved the right problem.");
  }

  return {
    summary: firstMeaningful(sections.product_summary, sections.raw_idea),
    targetUsers: scaffoldIfEmpty(sections.users, "TODO: Identify target users."),
    goals: scaffoldIfEmpty(sections.goals, "TODO: Define product goals."),
    mvpScope: scaffoldIfEmpty(sections.mvp_scope, "TODO: Define MVP scope."),
    nonGoals: scaffoldIfEmpty(sections.non_goals, "TODO: Define non-goals."),
    constraints: scaffoldIfEmpty(sections.constraints, "TODO: Define constraints."),
    successCriteria: scaffoldIfEmpty(sections.success_criteria, "TODO: Define success criteria."),
    scaffoldNotes,
    provenance
  };
}

function buildRequirements(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): readonly RequirementNode[] {
  const primaryStatement = firstMeaningful(
    sections.mvp_scope,
    sections.goals,
    sections.product_summary,
    sections.raw_idea
  );
  const successStatement = firstMeaningful(sections.success_criteria);
  const constraintStatement = firstMeaningful(sections.constraints);

  const requirements: RequirementNode[] = [
    {
      id: stableId("req-001", "req"),
      kind: "requirement",
      title: titleFrom(primaryStatement, "MVP scope"),
      status: "active",
      requirementType: "functional",
      statement: primaryStatement,
      provenance
    }
  ];

  if (successStatement) {
    requirements.push({
      id: stableId("req-002", "req"),
      kind: "requirement",
      title: titleFrom(successStatement, "Success criteria"),
      status: "active",
      requirementType: "non_functional",
      statement: successStatement,
      provenance
    });
  }

  if (constraintStatement) {
    requirements.push({
      id: stableId(`req-${String(requirements.length + 1).padStart(3, "0")}`, "req"),
      kind: "requirement",
      title: titleFrom(constraintStatement, "Constraint"),
      status: "active",
      requirementType: "constraint",
      statement: constraintStatement,
      provenance
    });
  }

  if (!successStatement) {
    scaffoldedFields.push("Requirement req-002 omitted because Success Criteria was empty.");
  }

  if (!constraintStatement) {
    scaffoldedFields.push("Constraint requirement omitted because Constraints was empty.");
  }

  return requirements;
}

function buildOpenQuestions(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): readonly OpenQuestionNode[] {
  const questions = takeStable(sections.open_questions, 3);
  const source = questions.length > 0 ? questions : ["Confirm unresolved product, technical, and rollout decisions before applying the graph."];

  if (questions.length === 0) {
    scaffoldedFields.push("Open question oq-001 scaffolded because Open Questions was empty.");
  }

  return source.map((question, index) => ({
    id: stableId(`oq-${String(index + 1).padStart(3, "0")}`, "oq"),
    kind: "open_question",
    title: titleFrom(question, `Open question ${index + 1}`),
    status: "active",
    question: ensureQuestion(question),
    priority: index === 0 ? "medium" : "low",
    blocksExecution: false,
    provenance
  }));
}

function buildRisks(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): readonly RiskNode[] {
  const riskLines = [...sections.constraints, ...sections.open_questions].filter((line) =>
    /\b(risk|concern|uncertain|unknown|dependency|depends|constraint|deadline|security|privacy)\b/iu.test(line)
  );
  const source = takeStable(riskLines, 2);

  if (source.length === 0) {
    scaffoldedFields.push("Risk risk-001 scaffolded because the brief did not name explicit risks.");
  }

  return (source.length > 0 ? source : ["Planning proposal may miss implementation detail that is not captured in the refined brief."]).map(
    (risk, index) => ({
      id: stableId(`risk-${String(index + 1).padStart(3, "0")}`, "risk"),
      kind: "risk",
      title: titleFrom(risk, `Risk ${index + 1}`),
      status: "active",
      likelihood: "medium",
      impact: index === 0 ? "medium" : "low",
      mitigation: "Review the dry-run graph before applying it and refine the brief if the proposal is too coarse.",
      blocksAfk: false,
      provenance
    })
  );
}

function buildComponents(sections: BriefSections, scaffoldedFields: string[]): readonly ComponentNode[] {
  const text = Object.values(sections).flat().join(" ").toLowerCase();
  const candidates = [
    { match: /\b(cli|command|terminal)\b/u, title: "CLI adapter", responsibility: "Expose planner workflows as deterministic local commands." },
    { match: /\b(graph|planning graph|dependency)\b/u, title: "Planning graph core", responsibility: "Represent planning nodes, dependency edges, validation, and readiness." },
    { match: /\b(file|filesystem|markdown|repository|repo)\b/u, title: "Filesystem projections", responsibility: "Read and write repository-native planning artifacts." },
    { match: /\b(api|server|service|backend)\b/u, title: "Application service", responsibility: "Coordinate use cases behind external interfaces." },
    { match: /\b(ui|frontend|web|screen)\b/u, title: "User interface", responsibility: "Provide the user-facing planning experience." }
  ];

  const components: ComponentNode[] = candidates
    .filter((candidate) => candidate.match.test(text))
    .slice(0, 3)
    .map((candidate, index) => ({
      id: stableId(`comp-${String(index + 1).padStart(3, "0")}`, "comp"),
      kind: "component" as const,
      title: candidate.title,
      status: "active" as const,
      responsibility: candidate.responsibility
    }));

  if (components.length === 0) {
    scaffoldedFields.push("Components omitted because no obvious component terms were present.");
  }

  return components;
}

function buildWorkItems(
  requirements: readonly RequirementNode[],
  hasComponents: boolean,
  scaffoldedFields: string[]
): readonly WorkItemNode[] {
  scaffoldedFields.push("Work Items are conservative scaffolds derived from brief sections, not an applied implementation plan.");

  const items = [
    {
      title: "Create canonical planning graph",
      acceptanceCriteria: ["A valid Planning Graph exists with requirements, risks, open questions, Work Items, execution slices, and document projections."]
    },
    {
      title: hasComponents ? "Implement component boundaries" : "Implement MVP workflow",
      acceptanceCriteria: [hasComponents ? "The obvious components from the brief are represented in code or architecture notes." : "The MVP workflow described by the refined brief is implemented end to end."]
    },
    {
      title: "Validate and review planning projections",
      acceptanceCriteria: ["Validation passes and generated planning artifacts are reviewed before apply or execution."]
    }
  ];

  return items.map((item, index) => ({
    id: stableId(`wi-${String(index + 1).padStart(3, "0")}`, "wi"),
    kind: "work_item",
    title: item.title,
    status: "planned",
    executionState: "backlog",
    readinessSnapshot: {
      graphVersion: graphVersion(1),
      labels: ["agent_eligible"],
      reasons: ["Dry-run proposal only; review before applying."]
    },
    acceptanceCriteria: item.acceptanceCriteria,
    validationMethods: [
      {
        type: "manual_review",
        expectedResult: `Reviewer confirms ${item.title.toLowerCase()} satisfies ${requirements[0]?.id ?? "req-001"}.`
      }
    ]
  }));
}

function buildDocumentProjections(): readonly DocumentProjectionNode[] {
  return [
    {
      id: stableId("doc-001", "doc"),
      kind: "document_projection",
      title: "Proposed PRD",
      status: "active",
      path: "docs/prd/proposed-plan.md",
      projectionType: "prd"
    },
    {
      id: stableId("doc-002", "doc"),
      kind: "document_projection",
      title: "Proposed Architecture",
      status: "active",
      path: "docs/architecture/proposed-architecture.md",
      projectionType: "architecture"
    },
    {
      id: stableId("doc-003", "doc"),
      kind: "document_projection",
      title: "Proposed Dependencies",
      status: "active",
      path: "planning/dependencies.md",
      projectionType: "dependency_view"
    }
  ];
}

function buildExecutionSlices(workItems: readonly WorkItemNode[]): readonly ExecutionSliceNode[] {
  return [
    {
      id: stableId("slice-001", "slice"),
      kind: "execution_slice",
      title: "Dry-run proposed MVP slice",
      status: "planned",
      workItems: workItems.map((workItem) => workItem.id),
      readinessSummary: "Proposed Work Items are agent-eligible scaffolds and must be reviewed before apply."
    }
  ];
}

function buildEdges(
  requirements: readonly RequirementNode[],
  risks: readonly RiskNode[],
  components: readonly ComponentNode[],
  workItems: readonly WorkItemNode[],
  documents: readonly DocumentProjectionNode[]
): readonly DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  for (const [index, workItem] of workItems.entries()) {
    const requirement = requirements[Math.min(index, requirements.length - 1)];
    edges.push({
      source: workItem.id,
      target: requirement.id,
      type: "satisfies",
      rationale: "Dry-run Work Item traces to a requirement inferred from the refined brief."
    });
  }

  for (const risk of risks) {
    edges.push({
      source: workItems[2]?.id ?? workItems[0].id,
      target: risk.id,
      type: "mitigates",
      rationale: "Review and validation mitigate dry-run planning risks."
    });
  }

  for (const component of components) {
    edges.push({
      source: workItems[1]?.id ?? workItems[0].id,
      target: component.id,
      type: "references",
      rationale: "Implementation work references an obvious component from the refined brief."
    });
  }

  for (const document of documents) {
    edges.push({
      source: document.id,
      target: workItems[0].id,
      type: "references",
      rationale: "Document projection is generated from the proposed planning graph."
    });
  }

  return edges;
}

function normalizeBriefLine(line: string): string {
  const trimmed = line.trim();
  if (
    !trimmed ||
    trimmed === "```" ||
    /^#/u.test(trimmed) ||
    /^TODO:/iu.test(trimmed) ||
    /^Source idea:/iu.test(trimmed) ||
    /^This Markdown file is user-owned\./u.test(trimmed)
  ) {
    return "";
  }

  return trimmed
    .replace(/^[-*]\s+/u, "")
    .replace(/^\d+[.)]\s+/u, "")
    .trim();
}

function firstMeaningful(...groups: readonly (readonly string[])[]): string {
  return groups.flat().find((line) => line.length > 0) ?? "Create the smallest coherent product described by the refined brief.";
}

function takeStable(lines: readonly string[], count: number): readonly string[] {
  return [...new Set(lines)].slice(0, count);
}

function scaffoldIfEmpty(lines: readonly string[], fallback: string): readonly string[] {
  return lines.length > 0 ? takeStable(lines, lines.length) : [fallback];
}

function titleFrom(statement: string, fallback: string): string {
  const title = statement.replace(/[.?]$/u, "").slice(0, 64).trim();
  return title || fallback;
}

function ensureQuestion(value: string): string {
  return value.endsWith("?") ? value : `${value}?`;
}
