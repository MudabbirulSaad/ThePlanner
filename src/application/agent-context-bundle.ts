import { renderDocumentProjection, renderWorkItemProjection } from "../core/index.js";
import type {
  ComponentNode,
  DecisionNode,
  DependencyEdge,
  DocumentProjectionNode,
  ExecutionSliceNode,
  HitlGateNode,
  OpenQuestionNode,
  PlanningGraph,
  PlanningNode,
  PlanningNodeId,
  RequirementNode,
  RiskNode,
  WorkItemId,
  WorkItemNode
} from "../core/index.js";

export interface ContextFileReader {
  readonly readIfExists: (path: string) => Promise<string | undefined>;
}

export type SupportedAgent = "codex" | "claude" | "gemini";

export interface AgentContextBundleSection {
  readonly path: string;
  readonly source: "workspace" | "generated";
  readonly content: string;
}

export interface ExecutionSliceContextSelection {
  readonly graph: PlanningGraph;
  readonly activeSlice?: ExecutionSliceNode;
  readonly immediateEdges: readonly DependencyEdge[];
  readonly directNodes: readonly PlanningNode[];
}

export async function buildAgentContextSections(args: {
  readonly graph: PlanningGraph;
  readonly workItem: WorkItemNode;
  readonly contextFileReader: ContextFileReader;
}): Promise<readonly AgentContextBundleSection[]> {
  const sections: AgentContextBundleSection[] = [];
  const agents = await args.contextFileReader.readIfExists("AGENTS.md");
  if (agents !== undefined) {
    sections.push({ path: "AGENTS.md", source: "workspace", content: agents });
  }

  const selection = selectExecutionSliceContext(args.graph, args.workItem);
  const selectedWorkItem = selection.graph.nodes.find(
    (node): node is WorkItemNode => node.kind === "work_item" && node.id === args.workItem.id
  );
  if (!selectedWorkItem) {
    throw new Error(`Selected context graph is missing Work Item: ${args.workItem.id}`);
  }

  const workItemProjection = renderWorkItemProjection(selection.graph, selectedWorkItem);
  sections.push({ path: workItemProjection.path, source: "generated", content: workItemProjection.content });
  sections.push({
    path: `planning/execution-context/${args.workItem.id}.md`,
    source: "generated",
    content: renderExecutionSliceContext(selection, args.workItem.id)
  });

  const dependencyView = selection.graph.nodes
    .filter(isDocumentProjectionNode)
    .filter((document) => document.projectionType === "dependency_view")
    .sort((left, right) => left.path.localeCompare(right.path))[0];
  if (dependencyView) {
    const rendered = renderDocumentProjection(selection.graph, dependencyView);
    sections.push({ path: rendered.path, source: "generated", content: rendered.content });
  }

  return sections;
}

export function selectExecutionSliceContext(graph: PlanningGraph, workItem: WorkItemNode): ExecutionSliceContextSelection {
  const graphClone = clonePlanningGraph(graph);
  const nodeById = new Map<PlanningNodeId, PlanningNode>(graphClone.nodes.map((node) => [node.id, node]));
  const selectedWorkItem = nodeById.get(workItem.id);
  if (!selectedWorkItem || selectedWorkItem.kind !== "work_item") {
    throw new Error(`Work Item not found in graph: ${workItem.id}`);
  }

  const activeSlice = graphClone.nodes
    .filter(isExecutionSliceNode)
    .filter((slice) => slice.workItems.includes(workItem.id))
    .sort(compareExecutionSlices)[0];
  const immediateEdges = graphClone.edges
    .filter((edge) => edge.source === workItem.id || edge.target === workItem.id)
    .sort(compareEdges);
  const selectedIds = new Set<PlanningNodeId>([workItem.id]);
  if (activeSlice) {
    selectedIds.add(activeSlice.id);
  }

  for (const edge of immediateEdges) {
    addContextNodeId(selectedIds, nodeById, edge.source);
    addContextNodeId(selectedIds, nodeById, edge.target);
  }

  for (const gate of graphClone.nodes.filter(isHitlGateNode)) {
    if (gate.blocks.includes(workItem.id)) {
      selectedIds.add(gate.id);
      for (const edge of graphClone.edges.filter((candidate) => candidate.source === gate.id)) {
        addContextNodeId(selectedIds, nodeById, edge.target);
      }
    }
  }

  const dependencyView = graphClone.nodes
    .filter(isDocumentProjectionNode)
    .filter((document) => document.projectionType === "dependency_view")
    .sort((left, right) => left.path.localeCompare(right.path))[0];
  if (dependencyView) {
    selectedIds.add(dependencyView.id);
  }

  const selectedEdges = graphClone.edges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .sort(compareEdges);
  const selectedNodes = graphClone.nodes.filter((node) => selectedIds.has(node.id)).sort(compareNodes);
  const directNodes = selectedNodes
    .filter((node) => node.id !== workItem.id && node.kind !== "document_projection" && node.kind !== "execution_slice")
    .sort(compareNodes);

  return {
    graph: {
      ...graphClone,
      productIntent: undefined,
      nodes: selectedNodes,
      edges: selectedEdges
    },
    ...(activeSlice ? { activeSlice } : {}),
    immediateEdges,
    directNodes
  };
}

export function renderAgentContextBundle(args: {
  readonly agent: SupportedAgent;
  readonly mode: "prepare" | "run";
  readonly graph: PlanningGraph;
  readonly workItem: WorkItemNode;
  readonly readiness: WorkItemNode["readinessSnapshot"];
  readonly validationCommands: readonly string[];
  readonly context: readonly AgentContextBundleSection[];
}): string {
  const usageSection =
    args.mode === "prepare"
      ? [
          "## Manual Use",
          "",
          `Paste this full bundle into ${agentDisplayName(args.agent)}. Do not execute an autonomous agent from theplanner prepare.`
        ]
      : [
          "## Run Instructions",
          "",
          `You are being invoked by theplanner run as ${agentDisplayName(args.agent)}. Complete the selected Work Item only, then stop.`
        ];

  return [
    "# Agent Context Bundle",
    "",
    `Agent: ${args.agent}`,
    `Work Item: ${args.workItem.id} - ${args.workItem.title}`,
    `Graph Version: ${args.graph.graphVersion}`,
    `Readiness: ${args.readiness.labels.join(", ")}`,
    "",
    "## Readiness Details",
    "",
    list(args.readiness.reasons),
    "",
    ...usageSection,
    "",
    "## Scope Reminder",
    "",
    `- Complete only Work Item ${args.workItem.id}.`,
    ...(args.workItem.boundaryNotes ?? []).map((note) => `- ${note}`),
    "- Preserve unrelated existing changes.",
    "- Do not add product features outside this Work Item.",
    "- Do not mark Work Items done from this bundle.",
    "- Do not call live LLM providers or external services unless the Work Item explicitly requires it.",
    "",
    "## Validation Commands",
    "",
    list(args.validationCommands),
    "",
    "## Safe Failure",
    "",
    args.workItem.safeFailureGuidance?.trim() || "Stop and report missing safe-failure guidance before making changes.",
    "",
    ...args.context.flatMap((section) => [
      `## Context: ${section.path}`,
      "",
      `Source: ${section.source}`,
      "",
      fence("markdown", section.content),
      ""
    ])
  ].join("\n");
}

export function renderAgentContextMarkdown(context: readonly AgentContextBundleSection[]): string {
  return [
    "# Agent Run Context",
    "",
    ...context.flatMap((section) => [
      `## ${section.path}`,
      "",
      `Source: ${section.source}`,
      "",
      fence("markdown", section.content),
      ""
    ])
  ].join("\n");
}

export function validationCommandsForWorkItem(
  workItem: WorkItemNode,
  defaultValidationCommands: readonly string[] | undefined
): readonly string[] {
  const workItemCommands = workItem.validationMethods.map((method) => method.command ?? method.expectedResult);
  return workItemCommands.length > 0 ? workItemCommands : (defaultValidationCommands ?? []);
}

function renderExecutionSliceContext(selection: ExecutionSliceContextSelection, workItemId: WorkItemId): string {
  return [
    "# Execution Slice Context",
    "",
    `Selected Work Item: ${workItemId}`,
    "",
    "## Active Execution Slice",
    "",
    selection.activeSlice
      ? [
          `- ${selection.activeSlice.id}: ${selection.activeSlice.title} (${selection.activeSlice.status})`,
          `- Work Items: ${selection.activeSlice.workItems.join(", ")}`,
          `- Readiness: ${selection.activeSlice.readinessSummary}`
        ].join("\n")
      : "- None",
    "",
    "## Immediate Dependency Edges",
    "",
    list(selection.immediateEdges.map((edge) => `${edge.source} ${edge.type} ${edge.target}: ${edge.rationale}`)),
    "",
    "## Direct Context Nodes",
    "",
    list(selection.directNodes.map(renderContextNode)),
    ""
  ].join("\n");
}

function renderContextNode(node: PlanningNode): string {
  if (isRequirementNode(node)) {
    return `${node.id} (${node.requirementType}, ${node.status}): ${node.title}. ${node.statement}`;
  }
  if (isDecisionNode(node)) {
    return `${node.id} (${node.status}): ${node.title}. Selected option: ${node.selectedOption}. Rationale: ${node.rationale}`;
  }
  if (isComponentNode(node)) {
    return `${node.id} (${node.status}): ${node.title}. Responsibility: ${node.responsibility}`;
  }
  if (isRiskNode(node)) {
    return `${node.id} (${node.status}, ${node.likelihood} likelihood, ${node.impact} impact): ${node.title}. Mitigation: ${node.mitigation}`;
  }
  if (isOpenQuestionNode(node)) {
    return `${node.id} (${node.status}, ${node.priority} priority): ${node.question}`;
  }
  if (isHitlGateNode(node)) {
    return `${node.id} (${node.status}): ${node.title}. Required action: ${node.requiredAction}. Blocks: ${node.blocks.join(", ")}`;
  }
  if (node.kind === "work_item") {
    return `${node.id} (${node.executionState}): ${node.title}`;
  }

  return `${node.id} (${node.kind}, ${node.status}): ${node.title}`;
}

function addContextNodeId(
  selectedIds: Set<PlanningNodeId>,
  nodeById: ReadonlyMap<PlanningNodeId, PlanningNode>,
  nodeId: PlanningNodeId
): void {
  const node = nodeById.get(nodeId);
  if (!node) {
    return;
  }

  if (
    node.kind === "requirement" ||
    node.kind === "decision" ||
    node.kind === "component" ||
    node.kind === "risk" ||
    node.kind === "open_question" ||
    node.kind === "hitl_gate" ||
    node.kind === "work_item"
  ) {
    selectedIds.add(node.id);
  }
}

function agentDisplayName(agent: SupportedAgent): string {
  return {
    codex: "Codex",
    claude: "Claude Code",
    gemini: "Gemini CLI"
  }[agent];
}

function fence(language: string, content: string): string {
  return `${content.includes("```") ? "````" : "```"}${language}\n${content.trimEnd()}\n${content.includes("```") ? "````" : "```"}`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "- None" : values.map((value) => `- ${value}`).join("\n");
}

function isDocumentProjectionNode(node: { readonly kind: string }): node is DocumentProjectionNode {
  return node.kind === "document_projection";
}

function isExecutionSliceNode(node: { readonly kind: string }): node is ExecutionSliceNode {
  return node.kind === "execution_slice";
}

function isRequirementNode(node: PlanningNode): node is RequirementNode {
  return node.kind === "requirement";
}

function isDecisionNode(node: PlanningNode): node is DecisionNode {
  return node.kind === "decision";
}

function isComponentNode(node: PlanningNode): node is ComponentNode {
  return node.kind === "component";
}

function isRiskNode(node: PlanningNode): node is RiskNode {
  return node.kind === "risk";
}

function isOpenQuestionNode(node: PlanningNode): node is OpenQuestionNode {
  return node.kind === "open_question";
}

function isHitlGateNode(node: PlanningNode): node is HitlGateNode {
  return node.kind === "hitl_gate";
}

function compareNodes(left: PlanningNode, right: PlanningNode): number {
  return left.id.localeCompare(right.id);
}

function compareEdges(left: DependencyEdge, right: DependencyEdge): number {
  return (
    left.source.localeCompare(right.source) ||
    left.type.localeCompare(right.type) ||
    left.target.localeCompare(right.target) ||
    left.rationale.localeCompare(right.rationale)
  );
}

function compareExecutionSlices(left: ExecutionSliceNode, right: ExecutionSliceNode): number {
  return executionSliceStatusRank(left) - executionSliceStatusRank(right) || left.id.localeCompare(right.id);
}

function executionSliceStatusRank(slice: ExecutionSliceNode): number {
  if (slice.status === "active") {
    return 0;
  }
  if (slice.status === "planned") {
    return 1;
  }

  return 2;
}

function clonePlanningGraph(graph: PlanningGraph): PlanningGraph {
  return structuredClone(graph) as PlanningGraph;
}
