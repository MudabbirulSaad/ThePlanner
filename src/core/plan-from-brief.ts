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
  PlanningNodeId,
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
  | "assumptions"
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
  assumptions: "assumptions",
  "key assumptions": "assumptions",
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
  const assumptions = buildAssumptions(sections, provenance, scaffoldedFields);
  const decisions = buildDecisions(sections, provenance, scaffoldedFields);
  const openQuestions = buildOpenQuestions(sections, provenance, scaffoldedFields);
  const risks = buildRisks(sections, provenance, scaffoldedFields);
  const components = buildComponents(sections, scaffoldedFields);
  const workItems = buildWorkItems(sections, requirements, components, risks, scaffoldedFields);
  const hitlGates = buildHitlGates(assumptions, risks, decisions, openQuestions, workItems, provenance);
  const documents = buildDocumentProjections();
  const slices = buildExecutionSlices(workItems);
  const edges = buildEdges(requirements, assumptions, decisions, risks, openQuestions, hitlGates, components, workItems, documents);

  return {
    graph: {
      schemaVersion: currentPlanningGraphSchemaVersion,
      graphVersion: graphVersion(1),
      source: sourceReference,
      productIntent,
      nodes: [
        ...requirements,
        ...decisions,
        ...assumptions,
        ...risks,
        ...openQuestions,
        ...hitlGates,
        ...components,
        ...workItems,
        ...documents,
        ...slices
      ],
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
    assumptions: [],
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

function buildAssumptions(
  sections: BriefSections,
  provenance: Provenance,
  scaffoldedFields: string[]
): readonly AssumptionNode[] {
  const assumptionLines = sections.assumptions.length > 0
    ? sections.assumptions
    : sections.constraints.filter((line) => /\b(assum|depends on|dependency|unknown|uncertain)\b/iu.test(line));
  const source = takeStable(assumptionLines, 3);

  if (source.length === 0) {
    scaffoldedFields.push("Assumptions omitted because no explicit assumption language was present.");
  }

  return source.map((line, index) => ({
    id: stableId(`asm-${String(index + 1).padStart(3, "0")}`, "asm"),
    kind: "assumption",
    title: titleFrom(cleanAssumptionStatement(line), `Assumption ${index + 1}`),
    status: "active",
    statement: cleanAssumptionStatement(line),
    confidence: confidenceFromLine(line),
    impactIfWrong: impactIfWrongFromLine(line),
    blocksAfk: uncertaintyBlocksExecution(line),
    provenance
  }));
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
  const inferredDecisionLines = explicitDecisionLines.length > 0
    ? []
    : [...sections.constraints, ...sections.mvp_scope, ...sections.goals].filter((line) =>
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
  const parsedQuestions = source.map(parseOpenQuestionLine);

  if (questions.length === 0) {
    scaffoldedFields.push("Open question oq-001 scaffolded because Open Questions was empty.");
  }

  return parsedQuestions.map((question, index) => ({
    id: stableId(`oq-${String(index + 1).padStart(3, "0")}`, "oq"),
    kind: "open_question",
    title: titleFrom(question.question, `Open question ${index + 1}`),
    status: "active",
    question: ensureQuestion(question.question),
    priority: question.blocksExecution ? "high" : index === 0 ? "medium" : "low",
    blocksExecution: question.blocksExecution,
    provenance
  }));
}

interface ParsedOpenQuestionLine {
  readonly question: string;
  readonly blocksExecution: boolean;
}

function parseOpenQuestionLine(line: string): ParsedOpenQuestionLine {
  const explicitBlocking = explicitBlockingFieldFromLine(line);
  const question = line.replace(/\s+\b(?:blocks execution|blocking)\s*:\s*(?:yes|no|true|false)\s*\.?\s*$/iu, "").trim();

  return {
    question: question || line,
    blocksExecution: explicitBlocking ?? uncertaintyBlocksExecution(line)
  };
}

function explicitBlockingFieldFromLine(line: string): boolean | undefined {
  const value = /\b(?:blocks execution|blocking)\s*:\s*(?<value>yes|no|true|false)\s*\.?\s*$/iu.exec(line)?.groups?.value.toLowerCase();
  if (value === "yes" || value === "true") {
    return true;
  }

  if (value === "no" || value === "false") {
    return false;
  }

  return undefined;
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
      likelihood: likelihoodFromLine(risk),
      impact: impactFromLine(risk, index),
      mitigation: "Review the dry-run graph before applying it and refine the brief if the proposal is too coarse.",
      blocksAfk: riskBlocksAfk(risk, index),
      provenance
    })
  );
}

function buildHitlGates(
  assumptions: readonly AssumptionNode[],
  risks: readonly RiskNode[],
  decisions: readonly DecisionNode[],
  openQuestions: readonly OpenQuestionNode[],
  workItems: readonly WorkItemNode[],
  provenance: Provenance
): readonly HitlGateNode[] {
  const affectedWorkItems = workItems.map((workItem) => workItem.id);
  const sources: { readonly id: PlanningNodeId; readonly title: string; readonly requiredAction: string }[] = [
    ...assumptions
      .filter((assumption) => assumption.blocksAfk)
      .map((assumption) => ({
        id: assumption.id,
        title: `Resolve blocking Assumption ${assumption.id}`,
        requiredAction: `Confirm or revise Assumption ${assumption.id}: ${trimSentence(assumption.statement)}.`
      })),
    ...risks
      .filter((risk) => risk.blocksAfk)
      .map((risk) => ({
        id: risk.id,
        title: `Resolve high-impact Risk ${risk.id}`,
        requiredAction: `Choose a mitigation or accept the execution risk for Risk ${risk.id}: ${trimSentence(risk.title)}.`
      })),
    ...decisions
      .filter((decision) => decision.status === "proposed" || decision.status === "revisit")
      .map((decision) => ({
        id: decision.id,
        title: `Accept unresolved Decision ${decision.id}`,
        requiredAction: `Accept, reject, or revise Decision ${decision.id}: ${trimSentence(decision.selectedOption)}.`
      })),
    ...openQuestions
      .filter((question) => question.blocksExecution)
      .map((question) => ({
        id: question.id,
        title: `Answer execution-blocking Open Question ${question.id}`,
        requiredAction: `Answer Open Question ${question.id}: ${trimSentence(question.question)}.`
      }))
  ];

  return sources.map((source, index) => ({
    id: stableId(`hitl-${String(index + 1).padStart(3, "0")}`, "hitl"),
    kind: "hitl_gate",
    title: source.title,
    status: "active",
    requiredAction: source.requiredAction,
    blocks: affectedWorkItems,
    provenance: {
      ...provenance,
      sourceReference: `${provenance.sourceReference}#${source.id}`
    }
  }));
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

interface WorkItemDraft {
  readonly title: string;
  readonly sourceLine: string;
  readonly acceptanceCriteria: readonly string[];
  readonly validationMethods: WorkItemNode["validationMethods"];
}

function buildWorkItems(
  sections: BriefSections,
  requirements: readonly RequirementNode[],
  components: readonly ComponentNode[],
  risks: readonly RiskNode[],
  scaffoldedFields: string[]
): readonly WorkItemNode[] {
  const sourceLines = workItemSourceLines(sections);
  const validationMethods = validationMethodsFromBrief(sections);
  const primaryRequirement = requirements[0]?.id ?? "req-001";
  const componentContext = components.length > 0
    ? ` Relevant components: ${components.map((component) => `${component.id} ${component.title}`).join(", ")}.`
    : "";
  const riskContext = risks.length > 0
    ? ` Known risks to respect: ${risks.map((risk) => `${risk.id} ${risk.title}`).join(", ")}.`
    : "";

  if (sourceLines.length === 0) {
    scaffoldedFields.push("Work Items scaffolded because MVP Scope and Success Criteria were empty.");
  }

  const drafts = sourceLines.map((line): WorkItemDraft => ({
    title: workItemTitleFromLine(line),
    sourceLine: line,
    acceptanceCriteria: acceptanceCriteriaForLine(line, sections.success_criteria),
    validationMethods
  }));

  return drafts.map((item, index) => ({
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
    contextSummary: `${item.title} implements this MVP slice from the refined brief: ${trimSentence(item.sourceLine)}. It traces to ${primaryRequirement}.${componentContext}${riskContext}`,
    boundaryNotes: [
      `Stay inside this execution slice: ${trimSentence(item.sourceLine)}.`,
      "Do not add product behavior outside the refined brief MVP scope."
    ],
    acceptanceCriteria: item.acceptanceCriteria,
    validationMethods: item.validationMethods,
    safeFailureGuidance: "Stop and report the exact missing context, failing validation, or unsafe assumption before changing unrelated scope."
  }));
}

function workItemSourceLines(sections: BriefSections): readonly string[] {
  const mvpLines = sections.mvp_scope.filter((line) => !line.startsWith("TODO:"));
  if (mvpLines.length >= 3) {
    return takeStable(mvpLines, 5);
  }

  const candidates = takeStable(
    [
      ...mvpLines,
      ...sections.success_criteria.filter((line) => !line.startsWith("TODO:")),
      ...sections.constraints.filter((line) => /\b(test|validation|persist|store|auth|api|ui|cli|workflow|offline)\b/iu.test(line))
    ],
    5
  ).slice(0, Math.max(3, Math.min(5, mvpLines.length + sections.success_criteria.length + sections.constraints.length)));

  const fallback = [
    "Implement the smallest coherent MVP workflow described by the refined brief.",
    "Add deterministic validation for the MVP workflow.",
    "Review the implementation against refined brief constraints."
  ];
  return candidates.length > 0 ? takeStable([...candidates, ...fallback], 3) : fallback;
}

function workItemTitleFromLine(line: string): string {
  const todoNoun = /\btodo(?:s)?\b/iu.test(line) ? "todo" : undefined;

  if (todoNoun && /\b(add|create|capture|new)\b/iu.test(line)) {
    return "Implement add todo workflow";
  }

  if (todoNoun && /\b(edit|update|rename)\b/iu.test(line)) {
    return "Implement edit todo workflow";
  }

  if (todoNoun && /\b(complete|completion|done|toggle|check off)\b/iu.test(line)) {
    return "Implement todo completion workflow";
  }

  if (todoNoun && /\b(delete|remove|clear)\b/iu.test(line)) {
    return "Implement delete todo workflow";
  }

  if (todoNoun && /\b(filter|search|sort|view)\b/iu.test(line)) {
    return "Implement todo filtering workflow";
  }

  if (todoNoun && /\b(persist|save|storage|local storage|offline)\b/iu.test(line)) {
    return "Implement todo persistence";
  }

  if (/\b(test|validation|validate|success criteria)\b/iu.test(line)) {
    return `Validate ${implementationSubjectFromLine(line)}`;
  }

  const withoutLead = line
    .replace(/^(users?|admins?|maintainers?|agents?)\s+(can|must|should|need to)\s+/iu, "")
    .replace(/^(support|allow|enable|provide|build|create|implement|add)\s+/iu, "")
    .replace(/[.:;]$/u, "")
    .trim();
  const subject = titleFrom(withoutLead, "MVP workflow").toLowerCase();
  return `Implement ${subject}`;
}

function implementationSubjectFromLine(line: string): string {
  if (/\btodo(?:s)?\b/iu.test(line)) {
    return "todo MVP behavior";
  }

  if (/\bwork items?\b/iu.test(line)) {
    return "generated Work Items";
  }

  return titleFrom(line, "MVP behavior").toLowerCase();
}

function acceptanceCriteriaForLine(line: string, successCriteria: readonly string[]): readonly string[] {
  const criteria = [
    `${trimSentence(line)} is implemented within the MVP scope.`,
    ...successCriteria.slice(0, 2).map((criterion) => `Implementation supports success criterion: ${trimSentence(criterion)}.`),
    "The slice has deterministic validation evidence before it is marked complete."
  ];

  return takeStable(criteria, criteria.length);
}

function validationMethodsFromBrief(sections: BriefSections): WorkItemNode["validationMethods"] {
  const command = validationCommandFromBrief(sections);
  if (command) {
    return [
      {
        type: "command",
        command,
        expectedResult: `${command} passes for the scoped implementation slice.`
      }
    ];
  }

  return [
    {
      type: "manual_review",
      expectedResult: "Safe manual validation: reviewer confirms the scoped behavior, boundaries, and acceptance criteria without autonomous execution."
    }
  ];
}

function validationCommandFromBrief(sections: BriefSections): string | undefined {
  const text = [...sections.constraints, ...sections.success_criteria, ...sections.mvp_scope].join(" ");
  const explicit = /\b(?:validation command|test command|run|use)\s*:\s*(?<command>npm\s+(?:test|run\s+(?:test|check|build|lint))|pnpm\s+(?:test|run\s+(?:test|check|build|lint))|yarn\s+(?:test|run\s+(?:test|check|build|lint))|bun\s+(?:test|run\s+(?:test|check|build|lint)))\b/iu.exec(text)?.groups?.command;
  if (explicit) {
    return explicit;
  }

  const inline = /\b(?<command>npm\s+(?:test|run\s+(?:test|check|build|lint))|pnpm\s+(?:test|run\s+(?:test|check|build|lint))|yarn\s+(?:test|run\s+(?:test|check|build|lint))|bun\s+(?:test|run\s+(?:test|check|build|lint)))\b/iu.exec(text)?.groups?.command;
  return inline;
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
  assumptions: readonly AssumptionNode[],
  decisions: readonly DecisionNode[],
  risks: readonly RiskNode[],
  openQuestions: readonly OpenQuestionNode[],
  hitlGates: readonly HitlGateNode[],
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
      for (const workItem of workItems) {
        edges.push({
          source: workItem.id,
          target: decision.id,
          type: "references",
          rationale: "Work Item references an accepted decision inferred from the refined brief."
        });
      }
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

  for (const assumption of assumptions.filter((node) => node.blocksAfk)) {
    for (const workItem of workItems) {
      edges.push({
        source: workItem.id,
        target: assumption.id,
        type: "depends_on",
        rationale: `Blocking Assumption ${assumption.id} must be confirmed before AFK execution.`
      });
    }
  }

  for (const risk of risks) {
    for (const workItem of workItems) {
      edges.push({
        source: workItem.id,
        target: risk.id,
        type: "references",
        rationale: "Work Item carries risk context inferred from the refined brief."
      });
    }

    edges.push({
      source: workItems[2]?.id ?? workItems[0].id,
      target: risk.id,
      type: "mitigates",
      rationale: "Review and validation mitigate dry-run planning risks."
    });

    if (risk.blocksAfk) {
      for (const workItem of workItems) {
        edges.push({
          source: workItem.id,
          target: risk.id,
          type: "depends_on",
          rationale: `High-impact Risk ${risk.id} must be resolved before AFK execution.`
        });
      }
    }
  }

  for (const question of openQuestions.filter((node) => node.blocksExecution)) {
    for (const workItem of workItems) {
      edges.push({
        source: workItem.id,
        target: question.id,
        type: "depends_on",
        rationale: `Open Question ${question.id} blocks safe execution.`
      });
    }
  }

  for (const hitlGate of hitlGates) {
    const causeId = hitlGate.provenance?.sourceReference.split("#").at(-1);
    for (const workItemId of hitlGate.blocks) {
      edges.push({
        source: hitlGate.id,
        target: workItemId,
        type: "blocks",
        rationale: `${hitlGate.id} blocks ${workItemId}: ${hitlGate.requiredAction}`
      });
    }

    if (causeId) {
      edges.push({
        source: hitlGate.id,
        target: causeId as PlanningNodeId,
        type: "references",
        rationale: `HITL Gate ${hitlGate.id} was derived from blocking uncertainty ${causeId}.`
      });
    }
  }

  for (const component of components) {
    for (const workItem of workItems) {
      edges.push({
        source: workItem.id,
        target: component.id,
        type: "references",
        rationale: "Implementation work references an obvious component from the refined brief."
      });
    }
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

function confidenceFromLine(line: string): AssumptionNode["confidence"] {
  if (/\blow confidence\b|\bconfidence:\s*low\b/iu.test(line)) {
    return "low";
  }

  if (/\bhigh confidence\b|\bconfidence:\s*high\b/iu.test(line)) {
    return "high";
  }

  return "medium";
}

function impactFromLine(line: string, index: number): RiskNode["impact"] {
  if (/\bhigh impact\b|\bimpact:\s*high\b|\bcritical\b|\bsevere\b/iu.test(line)) {
    return "high";
  }

  if (/\blow impact\b|\bimpact:\s*low\b/iu.test(line)) {
    return "low";
  }

  return index === 0 ? "medium" : "low";
}

function likelihoodFromLine(line: string): RiskNode["likelihood"] {
  if (/\bhigh likelihood\b|\blikelihood:\s*high\b/iu.test(line)) {
    return "high";
  }

  if (/\blow likelihood\b|\blikelihood:\s*low\b/iu.test(line)) {
    return "low";
  }

  return "medium";
}

function riskBlocksAfk(line: string, index: number): boolean {
  return uncertaintyBlocksExecution(line) || impactFromLine(line, index) === "high";
}

function uncertaintyBlocksExecution(line: string): boolean {
  return /\b(blocks? (?:afk|execution|implementation|safe progress)|execution-blocking|blocking|must (?:be )?(?:confirmed|resolved|decided|answered|confirm|resolve|decide|answer)|requires? human|human approval|approval required)\b/iu.test(line);
}

function cleanAssumptionStatement(line: string): string {
  return line
    .replace(/^\s*(assumption|assume)\s*:\s*/iu, "")
    .replace(/\s+\b(confidence|impact if wrong|impact|blocks afk|blocks execution)\s*:.+$/iu, "")
    .trim();
}

function impactIfWrongFromLine(line: string): string {
  return extractDecisionField(line, ["impact if wrong", "impact"]) ?? "AFK execution may proceed with incorrect planning context.";
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

function trimSentence(value: string): string {
  return value.replace(/[.!?]+$/u, "");
}
