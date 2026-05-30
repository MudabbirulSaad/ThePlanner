import type {
  ComponentNode,
  DecisionNode,
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
  | "decisions"
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
  decisions: "decisions",
  "decision log": "decisions",
  "architecture decisions": "decisions",
  "product decisions": "decisions",
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
  const decisions = buildDecisions(sections, provenance, scaffoldedFields);
  const openQuestions = buildOpenQuestions(sections, provenance, scaffoldedFields);
  const risks = buildRisks(sections, provenance, scaffoldedFields);
  const components = buildComponents(sections, scaffoldedFields);
  const workItems = buildWorkItems(requirements, components.length > 0, scaffoldedFields);
  const documents = buildDocumentProjections();
  const slices = buildExecutionSlices(workItems);
  const edges = buildEdges(requirements, decisions, risks, components, workItems, documents);

  return {
    graph: {
      schemaVersion: currentPlanningGraphSchemaVersion,
      graphVersion: graphVersion(1),
      source: sourceReference,
      productIntent,
      nodes: [...requirements, ...decisions, ...openQuestions, ...risks, ...components, ...workItems, ...documents, ...slices],
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
    decisions: [],
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

function buildDecisions(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): readonly DecisionNode[] {
  const explicitDecisionLines = sections.decisions;
  const inferredDecisionLines = [...sections.constraints, ...sections.mvp_scope, ...sections.goals].filter((line) =>
    /\b(accepted|decided|decision|choose|chose|use|proposed|revisit|alternative|option|rationale)\b/iu.test(line)
  );
  const source = [
    ...explicitDecisionLines.map((line) => ({ line, defaultStatus: "accepted" as const })),
    ...inferredDecisionLines.map((line) => ({ line, defaultStatus: "proposed" as const }))
  ]
    .slice(0, 4)
    .map(({ line, defaultStatus }) => parseDecisionLine(line, defaultStatus))
    .filter((decision): decision is ParsedDecision => decision !== undefined);

  if (source.length === 0) {
    scaffoldedFields.push("Decisions omitted because no explicit decision language was present.");
  }

  return source.map((decision, index) => ({
    id: stableId(`dec-${String(index + 1).padStart(3, "0")}`, "dec"),
    kind: "decision",
    title: titleFrom(decision.selectedOption, `Decision ${index + 1}`),
    status: decision.status,
    selectedOption: decision.selectedOption,
    rationale: decision.rationale,
    rejectedAlternatives: decision.rejectedAlternatives,
    unresolvedQuestions: decision.unresolvedQuestions,
    provenance
  }));
}

type ParsedDecision = Pick<
  DecisionNode,
  "status" | "selectedOption" | "rationale" | "rejectedAlternatives" | "unresolvedQuestions"
>;

function parseDecisionLine(
  line: string,
  defaultStatus: Extract<DecisionNode["status"], "accepted" | "proposed">
): ParsedDecision | undefined {
  const status = decisionStatusFrom(line);
  if (!status && !sectionsLineLooksLikeDecision(line)) {
    return undefined;
  }

  const selectedOption = cleanDecisionOption(extractDecisionField(line, ["selected option", "option", "decision", "choose", "use"]) ?? line);
  const rationale = cleanDecisionOption(extractDecisionField(line, ["rationale", "because", "why"]) ?? "Rationale not captured in the refined brief.");
  const rejectedAlternatives = splitDecisionList(
    extractDecisionField(line, ["rejected alternatives", "alternatives", "rejected", "not"])
  );
  const unresolvedQuestions = splitDecisionList(
    extractDecisionField(line, ["unresolved questions", "questions", "question", "revisit"])
  );

  return {
    status: status ?? (unresolvedQuestions.length > 0 ? "proposed" : defaultStatus),
    selectedOption,
    rationale,
    rejectedAlternatives,
    unresolvedQuestions
  };
}

function decisionStatusFrom(line: string): DecisionNode["status"] | undefined {
  if (/^\s*(accepted|decided|chosen)\s*:/iu.test(line) || /\b(status:\s*)?accepted\b/iu.test(line)) {
    return "accepted";
  }

  if (/^\s*(revisit|defer|deferred)\s*:/iu.test(line) || /\b(status:\s*)?revisit\b/iu.test(line)) {
    return "revisit";
  }

  if (/^\s*(proposed|proposal|candidate)\s*:/iu.test(line) || /\b(status:\s*)?proposed\b/iu.test(line)) {
    return "proposed";
  }

  return undefined;
}

function sectionsLineLooksLikeDecision(line: string): boolean {
  return /\b(decision|selected option|rationale|alternatives?|choose|chose|use)\b/iu.test(line);
}

function extractDecisionField(line: string, labels: readonly string[]): string | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const match = new RegExp(`\\b${escaped}\\s*:\\s*(?<value>.+?)(?=\\s+\\b(?:status|decision|selected option|option|rationale|because|why|rejected alternatives|alternatives|rejected|unresolved questions|questions|question|revisit|not)\\s*:|$)`, "iu").exec(line);
    const value = match?.groups?.value.trim();
    if (value) {
      return value;
    }
  }

  const because = /\bbecause\s+(?<value>.+)$/iu.exec(line)?.groups?.value.trim();
  if (labels.includes("because") && because) {
    return because;
  }

  return undefined;
}

function cleanDecisionOption(value: string): string {
  return value
    .replace(/^\s*(accepted|decided|chosen|proposed|proposal|candidate|revisit|defer|deferred)\s*:\s*/iu, "")
    .replace(/\s+\b(status|rationale|because|why|rejected alternatives|alternatives|rejected|unresolved questions|questions|question|revisit|not)\s*:.+$/iu, "")
    .trim();
}

function splitDecisionList(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s*(?:;|,|\bor\b)\s*/iu)
    .map((item) => cleanDecisionOption(item))
    .filter((item) => item.length > 0);
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
  const architectureRisks = [...sections.constraints, ...sections.open_questions].filter((line) =>
    /\b(risk|concern|uncertain|unknown|dependency|depends|security|privacy)\b/iu.test(line)
  );
  const candidates = [
    {
      match: /\b(cli|command|terminal)\b/u,
      title: "CLI adapter",
      responsibility: "Expose planner workflows as deterministic local commands.",
      interfaces: [
        {
          name: "Command interface",
          direction: "inbound" as const,
          contract: "Accepts local command arguments and prints deterministic output."
        }
      ],
      constraints: ["Keep command behavior deterministic and pipeline-friendly."],
      dependsOnTitle: "Application service"
    },
    {
      match: /\b(graph|planning graph|dependency)\b/u,
      title: "Planning graph core",
      responsibility: "Represent planning nodes, dependency edges, validation, and readiness.",
      interfaces: [
        {
          name: "Domain API",
          direction: "internal" as const,
          contract: "Pure TypeScript functions transform graph inputs without filesystem or process access."
        }
      ],
      constraints: matchingLines(sections.constraints, /\b(core|graph|domain|pure)\b/iu),
      dependsOnTitle: undefined
    },
    {
      match: /\b(file|filesystem|markdown|repository|repo)\b/u,
      title: "Filesystem projections",
      responsibility: "Read and write repository-native planning artifacts.",
      interfaces: [
        {
          name: "Projection IO",
          direction: "outbound" as const,
          contract: "Reads and writes Markdown and JSON artifacts at stable relative paths."
        }
      ],
      constraints: matchingLines(sections.constraints, /\b(file|filesystem|markdown|repo|repository|path)\b/iu),
      dependsOnTitle: "Planning graph core"
    },
    {
      match: /\b(api|server|service|backend)\b/u,
      title: "Application service",
      responsibility: "Coordinate use cases behind external interfaces.",
      interfaces: [
        {
          name: "Use case port",
          direction: "internal" as const,
          contract: "Coordinates core operations through explicit input and output ports."
        }
      ],
      constraints: matchingLines(sections.constraints, /\b(service|backend|api|port|use case)\b/iu),
      dependsOnTitle: "Planning graph core"
    },
    {
      match: /\b(ui|frontend|web|screen)\b/u,
      title: "User interface",
      responsibility: "Provide the user-facing planning experience.",
      interfaces: [
        {
          name: "User workflow",
          direction: "inbound" as const,
          contract: "Presents planning state and captures user review decisions."
        }
      ],
      constraints: matchingLines(sections.constraints, /\b(ui|frontend|web|screen|accessibility)\b/iu),
      dependsOnTitle: "Application service"
    }
  ];

  const selected = candidates
    .filter((candidate) => candidate.match.test(text))
    .slice(0, 3);
  const idByTitle = new Map<string, ComponentNode["id"]>(
    selected.map((candidate, index) => [
      candidate.title,
      stableId<ComponentNode["id"]>(`comp-${String(index + 1).padStart(3, "0")}`, "comp")
    ])
  );
  const components: ComponentNode[] = selected.map((candidate, index) => ({
      id: stableId(`comp-${String(index + 1).padStart(3, "0")}`, "comp"),
      kind: "component" as const,
      title: candidate.title,
      status: "active" as const,
      responsibility: candidate.responsibility,
      interfaces: candidate.interfaces,
      dependsOn: candidate.dependsOnTitle && idByTitle.has(candidate.dependsOnTitle)
        ? [idByTitle.get(candidate.dependsOnTitle)!]
        : [],
      constraints: takeStable(candidate.constraints, 3),
      risks: takeStable(architectureRisks, 2)
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
      title: "Proposed RFC",
      status: "active",
      path: "docs/rfc/proposed-decisions.md",
      projectionType: "rfc"
    },
    {
      id: stableId("doc-004", "doc"),
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
  decisions: readonly DecisionNode[],
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

  for (const decision of decisions) {
    if (decision.status === "accepted") {
      edges.push({
        source: workItems[0].id,
        target: decision.id,
        type: "references",
        rationale: "Work Item references an accepted decision inferred from the refined brief."
      });
      continue;
    }

    for (const workItem of workItems) {
      edges.push({
        source: workItem.id,
        target: decision.id,
        type: "depends_on",
        rationale: "Unresolved decision must be accepted before AFK execution."
      });
    }
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

function matchingLines(lines: readonly string[], pattern: RegExp): readonly string[] {
  return lines.filter((line) => pattern.test(line));
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
