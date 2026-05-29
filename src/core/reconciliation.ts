import type {
  DependencyEdge,
  ExecutionState,
  PlanningGraph,
  PlanningNode,
  PlanningNodeId,
  ReadinessLabel,
  ValidationMethod,
  WorkItemNode
} from "./graph.js";
import { graphVersion } from "./graph.js";
import { renderWorkItemProjection } from "./projections.js";
import { validatePlanningGraph } from "./validation.js";

export interface ProjectionInput {
  readonly path: string;
  readonly content: string;
}

export type GraphPatchOperation =
  | "replace_work_item_title"
  | "replace_work_item_execution_state"
  | "replace_work_item_acceptance_criteria"
  | "replace_work_item_validation_methods"
  | "replace_work_item_dependencies"
  | "replace_work_item_requirements";

export interface GraphPatch {
  readonly operation: GraphPatchOperation;
  readonly nodeId: string;
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly sourcePath: string;
}

export interface ReconciliationConflict {
  readonly nodeId: string;
  readonly field: string;
  readonly reason: string;
  readonly sourcePath: string;
}

export interface UnsupportedProjectionEdit {
  readonly nodeId: string;
  readonly field: string;
  readonly reason: string;
  readonly sourcePath: string;
}

export interface ReconciliationResult {
  readonly graphVersion: number;
  readonly proposedPatches: readonly GraphPatch[];
  readonly conflicts: readonly ReconciliationConflict[];
  readonly unsupportedProjectionEdits: readonly UnsupportedProjectionEdit[];
  readonly inspectedProjectionPaths: readonly string[];
}

interface ParsedWorkItemProjection {
  readonly id: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly sections: Readonly<Record<string, string>>;
}

const executionStates = new Set<ExecutionState>([
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "cancelled",
  "deferred"
]);

const readinessLabels = new Set<ReadinessLabel>([
  "human_only",
  "agent_eligible",
  "afk_ready",
  "hitl_gated",
  "blocked"
]);

export function reconcileGraphProjections(
  graph: PlanningGraph,
  projections: readonly ProjectionInput[]
): ReconciliationResult {
  const workItems = graph.nodes.filter(isWorkItem);
  const workItemById = new Map<string, WorkItemNode>(workItems.map((workItem) => [workItem.id, workItem]));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const proposedPatches: GraphPatch[] = [];
  const conflicts: ReconciliationConflict[] = [];
  const unsupportedProjectionEdits: UnsupportedProjectionEdit[] = [];

  for (const projection of projections) {
    const parsed = parseWorkItemProjection(projection.content);
    if (!parsed) {
      continue;
    }

    const workItem = workItemById.get(parsed.id);
    if (!workItem) {
      conflicts.push({
        nodeId: parsed.id,
        field: "id",
        reason: "Projection references a Work Item that is not present in the canonical graph.",
        sourcePath: projection.path
      });
      continue;
    }

    compareScalar("title", workItem.title, stringValue(parsed.frontmatter.title), workItem, projection, proposedPatches);
    compareExecutionState(workItem, parsed, projection, proposedPatches, conflicts);
    compareReadiness(workItem, parsed, projection, conflicts);
    compareAcceptanceCriteria(workItem, parsed, projection, proposedPatches);
    compareValidationMethods(workItem, parsed, projection, proposedPatches);
    compareIdListEdgeField({
      graph,
      nodeIds,
      workItem,
      parsed,
      projection,
      field: "depends_on",
      edgeType: "depends_on",
      operation: "replace_work_item_dependencies",
      targetKind: "work_item",
      proposedPatches,
      conflicts
    });
    compareIdListEdgeField({
      graph,
      nodeIds,
      workItem,
      parsed,
      projection,
      field: "requirements",
      edgeType: "satisfies",
      operation: "replace_work_item_requirements",
      targetKind: "requirement",
      proposedPatches,
      conflicts
    });
    compareReferenceOnlyField(graph, workItem, parsed, projection, "decisions", "decision", unsupportedProjectionEdits);
    compareReferenceOnlyField(graph, workItem, parsed, projection, "components", "component", unsupportedProjectionEdits);
    compareReferenceOnlyField(graph, workItem, parsed, projection, "risks", "risk", unsupportedProjectionEdits);
    compareReferenceOnlyField(graph, workItem, parsed, projection, "hitl_gates", "hitl_gate", unsupportedProjectionEdits);
    compareUnsupportedBodySection(graph, workItem, parsed, projection, "HITL Gates", unsupportedProjectionEdits);
    compareUnsupportedBodySection(graph, workItem, parsed, projection, "Agent Notes", unsupportedProjectionEdits);
  }

  const uniquePatches = dedupePatches(proposedPatches);
  return {
    graphVersion: graph.graphVersion,
    proposedPatches: uniquePatches,
    conflicts: validatePatchOutcome(graph, uniquePatches, conflicts),
    unsupportedProjectionEdits,
    inspectedProjectionPaths: projections.map((projection) => projection.path)
  };
}

export function applyGraphPatches(graph: PlanningGraph, patches: readonly GraphPatch[]): PlanningGraph {
  let nodes = graph.nodes;
  let edges = graph.edges;

  for (const patch of patches) {
    if (patch.operation === "replace_work_item_dependencies") {
      edges = replaceEdges(edges, patch.nodeId, "depends_on", patch.after as readonly string[]);
      continue;
    }

    if (patch.operation === "replace_work_item_requirements") {
      edges = replaceEdges(edges, patch.nodeId, "satisfies", patch.after as readonly string[]);
      continue;
    }

    nodes = nodes.map((node) => (node.id === patch.nodeId && isWorkItem(node) ? patchWorkItem(node, patch) : node));
  }

  const nextGraph = {
    ...graph,
    graphVersion: graphVersion(Number(graph.graphVersion) + 1),
    nodes,
    edges
  };

  return {
    ...nextGraph,
    nodes: nextGraph.nodes.map((node) =>
      isWorkItem(node)
        ? {
            ...node,
            readinessSnapshot: {
              ...node.readinessSnapshot,
              graphVersion: nextGraph.graphVersion
            }
          }
        : node
    )
  };
}

export function workItemProjectionPaths(graph: PlanningGraph): readonly string[] {
  return graph.nodes.filter(isWorkItem).map((workItem) => renderWorkItemProjection(graph, workItem).path);
}

function compareScalar(
  field: string,
  current: string,
  next: string | undefined,
  workItem: WorkItemNode,
  projection: ProjectionInput,
  patches: GraphPatch[]
) {
  if (next === undefined || next === current) {
    return;
  }

  patches.push({
    operation: "replace_work_item_title",
    nodeId: workItem.id,
    field,
    before: current,
    after: next,
    sourcePath: projection.path
  });
}

function compareExecutionState(
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  patches: GraphPatch[],
  conflicts: ReconciliationConflict[]
) {
  const next = stringValue(parsed.frontmatter.execution_state);
  if (!next || next === workItem.executionState) {
    return;
  }

  if (!executionStates.has(next as ExecutionState)) {
    conflicts.push({
      nodeId: workItem.id,
      field: "execution_state",
      reason: `Unsupported execution state: ${next}`,
      sourcePath: projection.path
    });
    return;
  }

  patches.push({
    operation: "replace_work_item_execution_state",
    nodeId: workItem.id,
    field: "execution_state",
    before: workItem.executionState,
    after: next,
    sourcePath: projection.path
  });
}

function compareReadiness(
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  conflicts: ReconciliationConflict[]
) {
  const next = stringList(parsed.frontmatter.readiness);
  if (next.length === 0 || sameList(next, workItem.readinessSnapshot.labels)) {
    return;
  }

  const unsupported = next.filter((label) => !readinessLabels.has(label as ReadinessLabel));
  conflicts.push({
    nodeId: workItem.id,
    field: "readiness",
    reason:
      unsupported.length > 0
        ? `Unsupported readiness labels: ${unsupported.join(", ")}`
        : "Readiness is derived by Graph Validation and cannot be reconciled from Markdown directly.",
    sourcePath: projection.path
  });
}

function compareAcceptanceCriteria(
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  patches: GraphPatch[]
) {
  const next = markdownList(parsed.sections["Acceptance Criteria"]);
  if (next.length === 0 || sameList(next, workItem.acceptanceCriteria)) {
    return;
  }

  patches.push({
    operation: "replace_work_item_acceptance_criteria",
    nodeId: workItem.id,
    field: "acceptance_criteria",
    before: workItem.acceptanceCriteria,
    after: next,
    sourcePath: projection.path
  });
}

function compareValidationMethods(
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  patches: GraphPatch[]
) {
  const frontmatterValidation = validationMethods(parsed.frontmatter.validation);
  const bodyCommands = markdownList(parsed.sections.Validation).map(stripInlineCode);
  if (
    frontmatterValidation.length === 0 &&
    bodyCommands.length > 0 &&
    sameList(
      bodyCommands,
      workItem.validationMethods.map((method) => method.command ?? method.expectedResult)
    )
  ) {
    return;
  }

  const next = frontmatterValidation.length > 0 ? frontmatterValidation : commandsToValidationMethods(bodyCommands);
  if (next.length === 0 || sameValidationMethods(next, workItem.validationMethods)) {
    return;
  }

  patches.push({
    operation: "replace_work_item_validation_methods",
    nodeId: workItem.id,
    field: "validation",
    before: workItem.validationMethods,
    after: next,
    sourcePath: projection.path
  });
}

function compareIdListEdgeField(args: {
  readonly graph: PlanningGraph;
  readonly nodeIds: ReadonlySet<string>;
  readonly workItem: WorkItemNode;
  readonly parsed: ParsedWorkItemProjection;
  readonly projection: ProjectionInput;
  readonly field: string;
  readonly edgeType: DependencyEdge["type"];
  readonly operation: GraphPatchOperation;
  readonly targetKind: PlanningNode["kind"];
  readonly proposedPatches: GraphPatch[];
  readonly conflicts: ReconciliationConflict[];
}) {
  const next = stringList(args.parsed.frontmatter[args.field]);
  if (next.length === 0 && !(args.field in args.parsed.frontmatter)) {
    return;
  }

  const current = outgoing(args.graph, args.workItem.id, args.edgeType).map((edge) => edge.target);
  if (sameList(next, current)) {
    return;
  }

  const badTarget = next.find((id) => !args.nodeIds.has(id) || nodeKind(args.graph, id) !== args.targetKind);
  if (badTarget) {
    args.conflicts.push({
      nodeId: args.workItem.id,
      field: args.field,
      reason: `Referenced ${args.targetKind} does not exist in canonical graph: ${badTarget}`,
      sourcePath: args.projection.path
    });
    return;
  }

  args.proposedPatches.push({
    operation: args.operation,
    nodeId: args.workItem.id,
    field: args.field,
    before: current,
    after: next,
    sourcePath: args.projection.path
  });
}

function compareReferenceOnlyField(
  graph: PlanningGraph,
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  field: string,
  kind: PlanningNode["kind"],
  unsupportedProjectionEdits: UnsupportedProjectionEdit[]
) {
  if (!(field in parsed.frontmatter)) {
    return;
  }

  const current = outgoing(graph, workItem.id, "references")
    .filter((edge) => nodeKind(graph, edge.target) === kind)
    .map((edge) => edge.target);
  const next = stringList(parsed.frontmatter[field]);
  if (!sameList(next, current)) {
    unsupportedProjectionEdits.push({
      nodeId: workItem.id,
      field,
      reason: `V1 detects ${field} drift but treats this relationship as unsupported/deferred, not canonical truth.`,
      sourcePath: projection.path
    });
  }
}

function compareUnsupportedBodySection(
  graph: PlanningGraph,
  workItem: WorkItemNode,
  parsed: ParsedWorkItemProjection,
  projection: ProjectionInput,
  sectionName: string,
  unsupportedProjectionEdits: UnsupportedProjectionEdit[]
) {
  const section = parsed.sections[sectionName];
  if (!section) {
    return;
  }

  const expected = parseWorkItemProjection(renderWorkItemProjection(graph, workItem).content)?.sections[sectionName] ?? "";
  if (normalizeMarkdown(section) !== normalizeMarkdown(expected)) {
    unsupportedProjectionEdits.push({
      nodeId: workItem.id,
      field: sectionName.toLowerCase().replaceAll(" ", "_"),
      reason: `V1 preserves edited ${sectionName} text as manual intent but does not map it to graph fields yet.`,
      sourcePath: projection.path
    });
  }
}

function validatePatchOutcome(
  graph: PlanningGraph,
  patches: readonly GraphPatch[],
  conflicts: readonly ReconciliationConflict[]
): readonly ReconciliationConflict[] {
  if (patches.length === 0) {
    return conflicts;
  }

  const validation = validatePlanningGraph(applyGraphPatches(graph, patches));
  if (validation.status !== "error") {
    return conflicts;
  }

  return [
    ...conflicts,
    ...validation.semanticErrors.map((error) => ({
      nodeId: String(error.nodeId ?? error.edge?.source ?? "graph"),
      field: "graph_validation",
      reason: error.message,
      sourcePath: "planning/graph.json"
    }))
  ];
}

function parseWorkItemProjection(content: string): ParsedWorkItemProjection | undefined {
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(content);
  if (!match?.groups) {
    return undefined;
  }

  const frontmatter = parseFrontmatter(match.groups.frontmatter);
  const id = stringValue(frontmatter.id);
  if (!id?.startsWith("wi-")) {
    return undefined;
  }

  return {
    id,
    frontmatter,
    sections: parseSections(match.groups.body)
  };
}

function parseFrontmatter(source: string): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const scalar = /^(?<key>[a-z_]+):(?:\s*(?<value>.*))?$/u.exec(line);
    if (!scalar?.groups) {
      continue;
    }

    const key = scalar.groups.key;
    const value = scalar.groups.value ?? "";
    if (value === "") {
      const block: Record<string, string>[] = [];
      while (lines[index + 1]?.startsWith("  - ")) {
        index += 1;
        const item: Record<string, string> = {};
        const first = lines[index].replace(/^ {2}-\s*/u, "");
        if (first) {
          const [itemKey, ...itemValue] = first.split(":");
          item[itemKey.trim()] = itemValue.join(":").trim();
        }
        while (lines[index + 1]?.startsWith("    ")) {
          index += 1;
          const nested = /^\s+(?<nestedKey>[a-z_]+):\s*(?<nestedValue>.*)$/u.exec(lines[index]);
          if (nested?.groups) {
            item[nested.groups.nestedKey] = nested.groups.nestedValue;
          }
        }
        block.push(item);
      }
      result[key] = block;
    } else {
      result[key] = parseFrontmatterValue(value);
    }
  }

  return result;
}

function parseFrontmatterValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1).trim();
    return body ? body.split(",").map((item) => item.trim()).filter(Boolean) : [];
  }

  return trimmed;
}

function parseSections(body: string): Readonly<Record<string, string>> {
  const sections: Record<string, string> = {};
  const lines = body.split("\n");
  let current: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      sections[current] = buffer.join("\n").trim();
    }
  };

  for (const line of lines) {
    const heading = /^## (?<title>.+)$/u.exec(line);
    if (heading?.groups) {
      flush();
      current = heading.groups.title.trim();
      buffer = [];
      continue;
    }

    if (current) {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

function validationMethods(value: unknown): readonly ValidationMethod[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, string>) : undefined))
    .filter((item): item is Record<string, string> => Boolean(item))
    .map((item) => ({
      type: item.type === "test" || item.type === "manual_review" ? item.type : "command",
      command: item.command || undefined,
      expectedResult: item.expected_result || item.expectedResult || item.command || "Pass"
    }));
}

function commandsToValidationMethods(commands: readonly string[]): readonly ValidationMethod[] {
  return commands.map((command) => ({
    type: "command",
    command,
    expectedResult: "Pass"
  }));
}

function markdownList(section: string | undefined): readonly string[] {
  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .map((line) => /^-\s+(?<item>.+)$/u.exec(line.trim())?.groups?.item.trim())
    .filter((item): item is string => Boolean(item));
}

function stripInlineCode(value: string): string {
  return value.replace(/^`(?<body>.*)`$/u, "$<body>").replace(/\.$/u, "");
}

function patchWorkItem(workItem: WorkItemNode, patch: GraphPatch): WorkItemNode {
  if (patch.operation === "replace_work_item_title") {
    return { ...workItem, title: patch.after as string };
  }

  if (patch.operation === "replace_work_item_execution_state") {
    return { ...workItem, executionState: patch.after as ExecutionState };
  }

  if (patch.operation === "replace_work_item_acceptance_criteria") {
    return { ...workItem, acceptanceCriteria: patch.after as readonly string[] };
  }

  if (patch.operation === "replace_work_item_validation_methods") {
    return { ...workItem, validationMethods: patch.after as readonly ValidationMethod[] };
  }

  return workItem;
}

function replaceEdges(
  edges: readonly DependencyEdge[],
  source: string,
  type: DependencyEdge["type"],
  targets: readonly string[]
): readonly DependencyEdge[] {
  return [
    ...edges.filter((edge) => !(edge.source === source && edge.type === type)),
    ...targets.map((target) => ({
      source: source as PlanningNodeId,
      target: target as PlanningNodeId,
      type,
      rationale: `Reconciled from Work Item projection.`
    }))
  ];
}

function outgoing(graph: PlanningGraph, source: string, type: DependencyEdge["type"]): readonly DependencyEdge[] {
  return graph.edges.filter((edge) => edge.source === source && edge.type === type);
}

function nodeKind(graph: PlanningGraph, id: string): PlanningNode["kind"] | undefined {
  return graph.nodes.find((node) => node.id === id)?.kind;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameValidationMethods(left: readonly ValidationMethod[], right: readonly ValidationMethod[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeMarkdown(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function dedupePatches(patches: readonly GraphPatch[]): readonly GraphPatch[] {
  const seen = new Set<string>();
  return patches.filter((patch) => {
    const key = `${patch.operation}:${patch.nodeId}:${patch.field}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isWorkItem(node: PlanningNode): node is WorkItemNode {
  return node.kind === "work_item";
}
