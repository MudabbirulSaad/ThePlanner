import type {
  DependencyEdge,
  PlanningGraph,
  PlanningNode,
  WorkItemNode
} from "../../core/index.js";
import type {
  TrackerIssueProposal,
  TrackerSyncAdapter,
  TrackerSyncPreview,
  TrackerSyncPreviewInput
} from "../../application/index.js";

export class GitHubDryRunTrackerSyncAdapter implements TrackerSyncAdapter {
  public readonly tracker = "github";

  public preview(input: TrackerSyncPreviewInput): TrackerSyncPreview {
    return {
      issues: input.graph.nodes
        .filter(isWorkItem)
        .map((workItem) => proposedGitHubIssue(input.graph, workItem))
        .sort((left, right) => left.workItemId.localeCompare(right.workItemId))
    };
  }
}

function proposedGitHubIssue(graph: PlanningGraph, workItem: WorkItemNode): TrackerIssueProposal {
  const dependencies = outgoing(graph, workItem.id, "depends_on").map((edge) => edge.target);
  const references = graph.edges
    .filter((edge) => edge.source === workItem.id && edge.type !== "depends_on")
    .map((edge) => edge.target)
    .sort();

  return {
    workItemId: workItem.id,
    title: `${workItem.id}: ${workItem.title}`,
    body: issueBody(workItem, dependencies, references),
    labels: [
      "planner",
      "work-item",
      `state:${workItem.executionState}`,
      ...workItem.readinessSnapshot.labels.map((label) => `readiness:${label}`)
    ].sort(),
    dependencies,
    references
  };
}

function issueBody(
  workItem: WorkItemNode,
  dependencies: readonly string[],
  references: readonly string[]
): string {
  return [
    `Planning Graph Work Item: ${workItem.id}`,
    "",
    "## Acceptance Criteria",
    list(workItem.acceptanceCriteria),
    "",
    "## Validation",
    list(workItem.validationMethods.map((method) => method.command ?? method.expectedResult)),
    "",
    "## Dependencies",
    list(dependencies),
    "",
    "## References",
    list(references),
    ""
  ].join("\n");
}

function outgoing(graph: PlanningGraph, source: string, type: DependencyEdge["type"]): readonly DependencyEdge[] {
  return graph.edges.filter((edge) => edge.source === source && edge.type === type).sort((left, right) => left.target.localeCompare(right.target));
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "- None" : values.map((value) => `- ${value}`).join("\n");
}

function isWorkItem(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item";
}
