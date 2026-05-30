import type {
  AssumptionNode,
  ComponentNode,
  DecisionNode,
  DependencyEdge,
  DocumentProjectionNode,
  HitlGateNode,
  OpenQuestionNode,
  PlanningGraph,
  PlanningNode,
  RequirementNode,
  RiskNode,
  WorkItemNode
} from "./graph.js";

export interface RenderedProjection {
  readonly path: string;
  readonly content: string;
}

export function renderAllProjections(graph: PlanningGraph): readonly RenderedProjection[] {
  return [
    ...graph.nodes
      .filter(isDocumentProjection)
      .map((document) => renderDocumentProjection(graph, document)),
    ...graph.nodes.filter(isWorkItem).map((workItem) => renderWorkItemProjection(graph, workItem))
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function renderDocumentProjection(
  graph: PlanningGraph,
  document: DocumentProjectionNode
): RenderedProjection {
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

export function renderWorkItemProjection(
  graph: PlanningGraph,
  workItem: WorkItemNode
): RenderedProjection {
  const dependencies = outgoing(graph, workItem.id, "depends_on").map((edge) => edge.target);
  const blocks = graph.edges
    .filter((edge) => edge.type === "depends_on" && edge.target === workItem.id)
    .map((edge) => edge.source);
  const requirements = outgoing(graph, workItem.id, "satisfies").map((edge) => edge.target);
  const hitlGates = hitlGatesForWorkItem(graph, workItem);

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
      hitl_gates: inlineList(hitlGates.map((gate) => gate.id))
  })}\n# ${workItem.title}\n\n## Context\n\n${workItem.title} supports ThePlanner V1 implementation.\n\n## Desired Outcome\n\n${workItem.acceptanceCriteria[0] ?? "Deliver the accepted Work Item outcome."}\n\n## Boundaries / Non-goals\n\nKeep implementation inside this Work Item's accepted slice.\n\n## Acceptance Criteria\n\n${list(workItem.acceptanceCriteria)}\n\n## Validation\n\n${list(workItem.validationMethods.map((method) => method.command ?? method.expectedResult))}\n\n## Dependencies\n\n${dependencies.length === 0 ? "No unresolved dependencies." : dependencies.map((id) => `Depends on \`${id}\`.`).join("\n")}\n\n## HITL Gates\n\n${renderWorkItemHitlGates(graph, hitlGates)}\n\n## Agent Notes\n\nUse the Planning Graph as the source of truth.\n`
  };
}

function renderPrdBody(graph: PlanningGraph): string {
  const requirements = graph.nodes.filter(isRequirement);
  const assumptions = graph.nodes.filter(isAssumption);
  const openQuestions = graph.nodes.filter(isOpenQuestion);
  const risks = graph.nodes.filter(isRisk);
  const workItems = graph.nodes.filter(isWorkItem);
  const intent = graph.productIntent;

  return `## Product Summary

${intent?.summary || "No product summary recorded."}

## Target Users

${list(intent?.targetUsers ?? [])}

## Goals

${list(intent?.goals ?? [])}

## MVP Scope

${list(intent?.mvpScope ?? [])}

## Non-goals

${list(intent?.nonGoals ?? [])}

## Constraints

${list(intent?.constraints ?? [])}

## Requirements

${list(requirements.map((node) => renderRequirement(graph, node)))}

## Success Criteria

${list(intent?.successCriteria ?? [])}

## Assumptions

${list(assumptions.map(renderAssumption))}

## Open Questions

${list(openQuestions.map(renderOpenQuestion))}

## Risks

${list(risks.map(renderRisk))}

## Work Item Traceability

${list(workItems.map((node) => renderWorkItemTrace(graph, node)))}

## Scaffold Notes

${list(intent?.scaffoldNotes ?? [])}
`;
}

function renderRfcBody(graph: PlanningGraph): string {
  const decisions = graph.nodes.filter(isDecision).sort(compareById);
  const accepted = decisions.filter((node) => node.status === "accepted");
  const unresolved = decisions.filter((node) => node.status === "proposed" || node.status === "revisit");

  return `## Decision Summary

${list(decisions.map((node) => `${node.id} (${node.status}): ${node.title}`))}

## Accepted Decisions

${list(accepted.map((node) => renderDecision(graph, node)))}

## Proposed / Revisit Decisions

${list(unresolved.map((node) => renderDecision(graph, node)))}
`;
}

function renderArchitectureBody(graph: PlanningGraph): string {
  const components = graph.nodes.filter(isComponent).sort(compareById);
  const constraints = graph.productIntent?.constraints ?? [];
  const risks = graph.nodes.filter(isRisk).sort(compareById);
  const openQuestions = graph.nodes.filter(isOpenQuestion).sort(compareById);
  const workItems = graph.nodes.filter(isWorkItem).sort(compareById);

  return `## Overview

${renderArchitectureOverview(graph)}

## Components

${list(components.map((node) => renderComponent(node)))}

## Interfaces / Contracts

${list(components.map((node) => renderComponentInterfaces(node)))}

## Dependency Notes

${list(renderArchitectureDependencies(graph, components))}

## Constraints

${list([
    ...constraints.map((constraint) => `Product constraint: ${trimSentence(constraint)}.`),
    ...components.flatMap((component) =>
      component.constraints.map((constraint) => `${component.id}: ${trimSentence(constraint)}.`)
    )
  ])}

## Risks

${list([
    ...risks.map(renderRisk),
    ...components.flatMap((component) =>
      component.risks.map((risk) => `${component.id}: ${trimSentence(risk)}.`)
    )
  ])}

## Open Questions

${list(openQuestions.map(renderOpenQuestion))}

## Work Item Traceability

${list(workItems.map((node) => renderArchitectureWorkItemTrace(graph, node)))}
`;
}

function renderDependencyView(graph: PlanningGraph, document: DocumentProjectionNode): string {
  const workItems = graph.nodes.filter(isWorkItem);
  const dependencyEdges = graph.edges.filter((edge) => edge.type === "depends_on");
  const hitlGates = graph.nodes.filter(isHitlGate).sort(compareById);
  return `${frontmatter({
    id: document.id,
    projection_type: document.projectionType,
    graph_version: graph.graphVersion,
    source_graph: "planning/graph.json"
  })}\n# ${document.title}\n\n## Graph Summary\n\nThe V1 Planning Graph contains ${graph.nodes.length} nodes and ${graph.edges.length} dependency edges.\n\n## Work Item Readiness\n\n${list(workItems.map((workItem) => `${workItem.id}: ${workItem.readinessSnapshot.labels.join(", ")}`))}\n\n## HITL Gates\n\n${list(hitlGates.map((gate) => renderHitlGate(graph, gate)))}\n\n## Dependency Edges\n\n${list(dependencyEdges.map((edge) => `${edge.source} depends on ${edge.target}`))}\n`;
}

function frontmatter(values: Record<string, string | number>): string {
  return `---\n${Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}\n---\n`;
}

function outgoing(
  graph: PlanningGraph,
  source: string,
  type: DependencyEdge["type"]
): readonly DependencyEdge[] {
  return graph.edges.filter((edge) => edge.source === source && edge.type === type);
}

function inlineList(values: readonly string[]): string {
  return values.length === 0 ? "[]" : `[${values.join(", ")}]`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "- None" : values.map((value) => `- ${value}`).join("\n");
}

function renderRequirement(graph: PlanningGraph, requirement: RequirementNode): string {
  const workItems = graph.edges
    .filter((edge) => edge.type === "satisfies" && edge.target === requirement.id)
    .map((edge) => edge.source);
  const suffix =
    workItems.length === 0 ? "" : ` Trace: ${workItems.map((id) => `\`${id}\``).join(", ")}.`;
  return `${requirement.id} (${requirement.requirementType}, ${requirement.status}): ${requirement.title}. ${requirement.statement}${suffix}`;
}

function renderAssumption(node: AssumptionNode): string {
  const blocker = node.blocksAfk ? "Blocks AFK." : "Does not block AFK.";
  return `${node.id} (${node.confidence} confidence): ${node.title}. ${node.statement} Impact if wrong: ${node.impactIfWrong} ${blocker}`;
}

function renderOpenQuestion(node: OpenQuestionNode): string {
  const blocker = node.blocksExecution ? "Blocks execution." : "Does not block execution.";
  return `${node.id} (${node.priority} priority): ${node.question} ${blocker}`;
}

function renderRisk(node: RiskNode): string {
  const blocker = node.blocksAfk ? "Blocks AFK." : "Does not block AFK.";
  return `${node.id} (${node.likelihood} likelihood, ${node.impact} impact): ${node.title}. Mitigation: ${node.mitigation} ${blocker}`;
}

function renderHitlGate(graph: PlanningGraph, node: HitlGateNode): string {
  const causes = outgoing(graph, node.id, "references")
    .map((edge) => edge.target)
    .sort();
  const causeText = causes.length === 0 ? "Cause: none recorded." : `Cause: ${causes.map((id) => `\`${id}\``).join(", ")}.`;
  const blocksText = node.blocks.length === 0 ? "Blocks: none." : `Blocks: ${node.blocks.map((id) => `\`${id}\``).join(", ")}.`;
  return `${node.id} (${node.status}): ${node.title}. Required action: ${trimSentence(node.requiredAction)}. ${causeText} ${blocksText}`;
}

function renderWorkItemHitlGates(graph: PlanningGraph, hitlGates: readonly HitlGateNode[]): string {
  if (hitlGates.length === 0) {
    return "None.";
  }

  return hitlGates.map((gate) => `- ${renderHitlGate(graph, gate)}`).join("\n");
}

function renderDecision(graph: PlanningGraph, node: DecisionNode): string {
  const affectedNodes = graph.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => (edge.source === node.id ? edge.target : edge.source))
    .sort();
  const alternatives = node.rejectedAlternatives.length === 0
    ? "None captured."
    : node.rejectedAlternatives.map((alternative) => trimSentence(alternative)).join("; ") + ".";
  const questions = node.unresolvedQuestions.length === 0
    ? "None."
    : node.unresolvedQuestions.map((question) => trimSentence(question)).join("; ") + ".";
  const affected = affectedNodes.length === 0
    ? "None recorded."
    : affectedNodes.map((id) => `\`${id}\``).join(", ");

  return `${node.id} (${node.status}): ${node.title}. Selected option: ${trimSentence(node.selectedOption)}. Rationale: ${trimSentence(node.rationale)}. Rejected alternatives: ${alternatives} Unresolved questions: ${questions} Affected nodes: ${affected}.`;
}

function renderComponent(node: ComponentNode): string {
  const dependencies = node.dependsOn.length === 0
    ? "Depends on: none."
    : `Depends on: ${node.dependsOn.map((id) => `\`${id}\``).join(", ")}.`;
  return `${node.id}: ${node.title}. Responsibility: ${node.responsibility} ${dependencies}`;
}

function renderArchitectureOverview(graph: PlanningGraph): string {
  const summary = graph.productIntent?.summary;
  if (summary) {
    return `${summary}\n\nSource graph: \`planning/graph.json\`. Graph version: ${graph.graphVersion}.`;
  }

  return `No product summary recorded.\n\nSource graph: \`planning/graph.json\`. Graph version: ${graph.graphVersion}.`;
}

function renderComponentInterfaces(node: ComponentNode): string {
  if (node.interfaces.length === 0) {
    return `${node.id}: None.`;
  }

  return `${node.id}: ${node.interfaces
    .map(
      (componentInterface) =>
        `${componentInterface.name} (${componentInterface.direction}) - ${trimSentence(componentInterface.contract)}`
    )
    .join("; ")}.`;
}

function renderArchitectureDependencies(
  graph: PlanningGraph,
  components: readonly ComponentNode[]
): readonly string[] {
  const componentDependencyNotes = components.flatMap((component) =>
    component.dependsOn.map((dependency) => `${component.id} depends on ${dependency} (component dependency).`)
  );
  const componentIds = new Set(components.map((component) => component.id));
  const graphDependencyNotes = graph.edges
    .filter((edge) => edge.type === "depends_on")
    .filter((edge) => componentIds.has(edge.source as ComponentNode["id"]) || componentIds.has(edge.target as ComponentNode["id"]))
    .sort((left, right) => `${left.source}:${left.target}`.localeCompare(`${right.source}:${right.target}`))
    .map(
      (edge) =>
        `${edge.source} depends on ${edge.target} (graph edge). Rationale: ${
          edge.rationale ? trimSentence(edge.rationale) : "None"
        }.`
    );

  return [...componentDependencyNotes, ...graphDependencyNotes];
}

function renderArchitectureWorkItemTrace(graph: PlanningGraph, workItem: WorkItemNode): string {
  const relatedComponents = graph.edges
    .filter(
      (edge) =>
        edge.type === "references" &&
        (edge.source === workItem.id || edge.target === workItem.id)
    )
    .map((edge) => (edge.source === workItem.id ? edge.target : edge.source))
    .filter((id) => graph.nodes.some((node) => node.kind === "component" && node.id === id))
    .sort();
  const componentText =
    relatedComponents.length === 0 ? "none" : relatedComponents.map((id) => `\`${id}\``).join(", ");
  return `${workItem.id}: [${workItem.title}](${renderWorkItemProjection(graph, workItem).path}). Components: ${componentText}. Readiness: ${workItem.readinessSnapshot.labels.join(", ")}.`;
}

function trimSentence(value: string): string {
  return value.replace(/[.!?]+$/u, "");
}

function renderWorkItemTrace(graph: PlanningGraph, workItem: WorkItemNode): string {
  const requirements = outgoing(graph, workItem.id, "satisfies").map((edge) => edge.target);
  const dependencies = outgoing(graph, workItem.id, "depends_on").map((edge) => edge.target);
  const requirementText =
    requirements.length === 0 ? "none" : requirements.map((id) => `\`${id}\``).join(", ");
  const dependencyText =
    dependencies.length === 0 ? "none" : dependencies.map((id) => `\`${id}\``).join(", ");
  return `${workItem.id}: ${workItem.title}. Requirements: ${requirementText}. Readiness: ${workItem.readinessSnapshot.labels.join(", ")}. Depends on: ${dependencyText}.`;
}

function slug(id: string, title: string): string {
  return `${id}-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function isWorkItem(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item";
}

function isDocumentProjection(node: PlanningNode): node is DocumentProjectionNode {
  return node.kind === "document_projection";
}

function isRequirement(node: PlanningNode): node is RequirementNode {
  return node.kind === "requirement";
}

function isAssumption(node: PlanningNode): node is AssumptionNode {
  return node.kind === "assumption";
}

function isOpenQuestion(node: PlanningNode): node is OpenQuestionNode {
  return node.kind === "open_question";
}

function isRisk(node: PlanningNode): node is RiskNode {
  return node.kind === "risk";
}

function isDecision(node: PlanningNode): node is DecisionNode {
  return node.kind === "decision";
}

function isComponent(node: PlanningNode): node is ComponentNode {
  return node.kind === "component";
}

function isHitlGate(node: PlanningNode): node is HitlGateNode {
  return node.kind === "hitl_gate";
}

function hitlGatesForWorkItem(graph: PlanningGraph, workItem: WorkItemNode): readonly HitlGateNode[] {
  return graph.nodes
    .filter(isHitlGate)
    .filter((gate) => gate.blocks.includes(workItem.id))
    .sort(compareById);
}

function compareById(left: PlanningNode, right: PlanningNode): number {
  return left.id.localeCompare(right.id);
}
