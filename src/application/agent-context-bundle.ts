import { renderDocumentProjection, renderWorkItemProjection } from "../core/index.js";
import type { DocumentProjectionNode, PlanningGraph, PlanningNodeId, WorkItemId, WorkItemNode } from "../core/index.js";

export interface ContextFileReader {
  readonly readIfExists: (path: string) => Promise<string | undefined>;
}

export type SupportedAgent = "codex" | "claude" | "gemini";

export interface AgentContextBundleSection {
  readonly path: string;
  readonly source: "workspace" | "generated";
  readonly content: string;
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

  const workItemProjection = renderWorkItemProjection(args.graph, args.workItem);
  sections.push({ path: workItemProjection.path, source: "generated", content: workItemProjection.content });

  const dependencyView = args.graph.nodes
    .filter(isDocumentProjectionNode)
    .filter((document) => document.projectionType === "dependency_view")
    .sort((left, right) => left.path.localeCompare(right.path))[0];
  if (dependencyView) {
    const rendered = renderDocumentProjection(args.graph, dependencyView);
    sections.push({ path: rendered.path, source: "generated", content: rendered.content });
  }

  for (const document of relatedDocumentProjections(args.graph, args.workItem.id)) {
    if (document.projectionType === "dependency_view") {
      continue;
    }
    const rendered = renderDocumentProjection(args.graph, document);
    sections.push({ path: rendered.path, source: "generated", content: rendered.content });
  }

  return sections;
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

function relatedDocumentProjections(graph: PlanningGraph, workItemId: WorkItemId): readonly DocumentProjectionNode[] {
  const relatedIds = new Set<PlanningNodeId>([workItemId]);
  for (const edge of graph.edges) {
    if (edge.source === workItemId) {
      relatedIds.add(edge.target);
    }
    if (edge.target === workItemId) {
      relatedIds.add(edge.source);
    }
  }

  return graph.nodes
    .filter(isDocumentProjectionNode)
    .filter((document) =>
      graph.edges.some(
        (edge) =>
          edge.type === "references" &&
          ((edge.source === document.id && relatedIds.has(edge.target)) ||
            (relatedIds.has(edge.source) && edge.target === document.id))
      )
    )
    .sort((left, right) => left.path.localeCompare(right.path));
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
