import type {
  DependencyEdge,
  DocumentProjectionNode,
  PlanningGraph,
  PlanningNode,
  WorkItemNode
} from "./graph.js";

export interface RenderedProjection {
  readonly path: string;
  readonly content: string;
}

export function renderAllProjections(graph: PlanningGraph): readonly RenderedProjection[] {
  return [
    ...graph.nodes.filter(isDocumentProjection).map((document) => renderDocumentProjection(graph, document)),
    ...graph.nodes.filter(isWorkItem).map((workItem) => renderWorkItemProjection(graph, workItem))
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function renderDocumentProjection(graph: PlanningGraph, document: DocumentProjectionNode): RenderedProjection {
  if (document.projectionType === "dependency_view") {
    return { path: document.path, content: renderDependencyView(graph, document) };
  }

  const sections = {
    prd: renderPrdBody(graph),
    rfc: renderRfcBody(graph),
    architecture: renderArchitectureBody(graph),
    work_item: ""
  };

  return {
    path: document.path,
    content: `${frontmatter({
      id: document.id,
      projection_type: document.projectionType,
      graph_version: graph.graphVersion,
      source_graph: "planning/graph.json"
    })}\n# ${document.title}\n\n${sections[document.projectionType]}`
  };
}

export function renderWorkItemProjection(graph: PlanningGraph, workItem: WorkItemNode): RenderedProjection {
  const dependencies = outgoing(graph, workItem.id, "depends_on").map((edge) => edge.target);
  const blocks = graph.edges
    .filter((edge) => edge.type === "depends_on" && edge.target === workItem.id)
    .map((edge) => edge.source);
  const requirements = outgoing(graph, workItem.id, "satisfies").map((edge) => edge.target);

  return {
    path: `planning/work-items/${slug(workItem.id, workItem.title)}.md`,
    content: `${frontmatter({
      id: workItem.id,
      title: workItem.title,
      graph_version: graph.graphVersion,
      execution_state: workItem.executionState,
      readiness: `[${workItem.readinessSnapshot.labels.join(", ")}]`,
      depends_on: inlineList(dependencies),
      blocks: inlineList(blocks),
      requirements: inlineList(requirements),
      hitl_gates: "[]"
    })}\n# ${workItem.title}\n\n## Context\n\n${workItem.title} supports ThePlanner V1 implementation.\n\n## Desired Outcome\n\n${workItem.acceptanceCriteria[0] ?? "Deliver the accepted Work Item outcome."}\n\n## Boundaries / Non-goals\n\nKeep implementation inside this Work Item's accepted slice.\n\n## Acceptance Criteria\n\n${list(workItem.acceptanceCriteria)}\n\n## Validation\n\n${list(workItem.validationMethods.map((method) => method.command ?? method.expectedResult))}\n\n## Dependencies\n\n${dependencies.length === 0 ? "No unresolved dependencies." : dependencies.map((id) => `Depends on \`${id}\`.`).join("\n")}\n\n## HITL Gates\n\nNone.\n\n## Agent Notes\n\nUse the Planning Graph as the source of truth.\n`
  };
}

function renderPrdBody(graph: PlanningGraph): string {
  const requirements = graph.nodes.filter((node) => node.kind === "requirement");
  return `## Requirements\n\n${list(requirements.map((node) => `${node.id}: ${node.title}`))}\n`;
}

function renderRfcBody(graph: PlanningGraph): string {
  const decisions = graph.nodes.filter((node) => node.kind === "decision");
  return `## Decisions\n\n${list(decisions.map((node) => `${node.id}: ${node.title}`))}\n`;
}

function renderArchitectureBody(graph: PlanningGraph): string {
  const components = graph.nodes.filter((node) => node.kind === "component");
  return `## Components\n\n${list(components.map((node) => `${node.id}: ${node.title}`))}\n\n## Architecture Boundary\n\nCore remains independent from CLI and infrastructure adapters.\n`;
}

function renderDependencyView(graph: PlanningGraph, document: DocumentProjectionNode): string {
  const workItems = graph.nodes.filter(isWorkItem);
  const dependencyEdges = graph.edges.filter((edge) => edge.type === "depends_on");
  return `${frontmatter({
    id: document.id,
    projection_type: document.projectionType,
    graph_version: graph.graphVersion,
    source_graph: "planning/graph.json"
  })}\n# ${document.title}\n\n## Graph Summary\n\nThe V1 Planning Graph contains ${graph.nodes.length} nodes and ${graph.edges.length} dependency edges.\n\n## Work Item Readiness\n\n${list(workItems.map((workItem) => `${workItem.id}: ${workItem.readinessSnapshot.labels.join(", ")}`))}\n\n## Dependency Edges\n\n${list(dependencyEdges.map((edge) => `${edge.source} depends on ${edge.target}`))}\n`;
}

function frontmatter(values: Record<string, string | number>): string {
  return `---\n${Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}\n---\n`;
}

function outgoing(graph: PlanningGraph, source: string, type: DependencyEdge["type"]): readonly DependencyEdge[] {
  return graph.edges.filter((edge) => edge.source === source && edge.type === type);
}

function inlineList(values: readonly string[]): string {
  return values.length === 0 ? "[]" : `[${values.join(", ")}]`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "- None" : values.map((value) => `- ${value}`).join("\n");
}

function slug(id: string, title: string): string {
  return `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function isWorkItem(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item";
}

function isDocumentProjection(node: PlanningNode): node is DocumentProjectionNode {
  return node.kind === "document_projection";
}
