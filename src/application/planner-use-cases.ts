import {
  applyGraphPatches,
  generateIntakeQuestions,
  proposePlanningGraphFromBrief,
  renderRefinedBriefScaffold,
  reconcileGraphProjections,
  renderAllProjections,
  validatePlanningGraph,
  workItemProjectionPaths
} from "../core/index.js";
import type {
  GraphValidationResult,
  IntakeQuestionSet,
  PlanningGraph,
  ProjectionInput,
  ReconciliationResult,
  RenderedProjection
} from "../core/index.js";
import { intakeBriefTemplate } from "../templates/intake-brief-template.js";
import { serializePlanningGraphJson } from "./graph-json.js";

export interface GraphRepository {
  readonly load: () => Promise<PlanningGraph>;
  readonly loadIfExists?: () => Promise<PlanningGraph | undefined>;
  readonly save?: (graph: PlanningGraph) => Promise<void>;
}

export interface ProjectionWriter {
  readonly writeAll: (projections: readonly RenderedProjection[]) => Promise<readonly string[] | void>;
}

export interface ProjectionReader {
  readonly readMany: (paths: readonly string[]) => Promise<readonly ProjectionInput[]>;
  readonly readExistingMany?: (paths: readonly string[]) => Promise<readonly ExistingProjectionInput[]>;
}

export interface ExistingProjectionInput {
  readonly requestedPath: string;
  readonly path: string;
  readonly content?: string;
}

export type ProjectionExportStatus = "created" | "updated" | "unchanged";

export interface ProjectionExportEntry {
  readonly path: string;
  readonly requestedPath: string;
  readonly status: ProjectionExportStatus;
  readonly humanAuthoredSections: readonly string[];
}

export interface ProjectionOverwriteWarning {
  readonly path: string;
  readonly sections: readonly string[];
  readonly reason: string;
}

export interface PlanningChangeLogEvent {
  readonly event_id: string;
  readonly timestamp: string;
  readonly graph_version_before: number;
  readonly graph_version_after: number;
  readonly actor: string;
  readonly operation_type: string;
  readonly affected_node_ids: readonly string[];
  readonly approval_status?: string;
  readonly summary: string;
  readonly provenance_reference?: string;
}

export interface ChangeLogWriter {
  readonly append: (event: PlanningChangeLogEvent) => Promise<void>;
}

export type WorkspaceEntryKind = "directory" | "file";
export type WorkspaceEntryStatus = "created" | "existing";

export interface WorkspaceInitEntry {
  readonly path: string;
  readonly kind: WorkspaceEntryKind;
  readonly status: WorkspaceEntryStatus;
}

export interface WorkspaceInitializer {
  readonly ensureDirectory: (path: string) => Promise<WorkspaceEntryStatus>;
  readonly writeFileIfMissing: (path: string, content: string) => Promise<WorkspaceEntryStatus>;
}

export interface IntakeIdeaReader {
  readonly read: (path: string) => Promise<string>;
}

export interface RefinedBriefReader {
  readonly read: (path: string) => Promise<string>;
}

export type RefinedBriefWriteStatus = "created" | "overwritten" | "skipped";

export interface RefinedBriefWriter {
  readonly write: (path: string, content: string, options?: { readonly overwrite?: boolean }) => Promise<RefinedBriefWriteStatus>;
}

export interface ValidateGraphUseCaseResult {
  readonly validation: GraphValidationResult;
  readonly exitCode: number;
}

export async function validateGraphUseCase(graphRepository: GraphRepository): Promise<ValidateGraphUseCaseResult> {
  const validation = validatePlanningGraph(await graphRepository.load());
  return {
    validation,
    exitCode: validation.status === "error" ? 1 : 0
  };
}

export async function statusUseCase(graphRepository: GraphRepository): Promise<{
  readonly graphVersion: number;
  readonly status: string;
  readonly readinessSummary: GraphValidationResult["readinessSummary"];
}> {
  const validation = validatePlanningGraph(await graphRepository.load());
  return {
    graphVersion: validation.graphVersion,
    status: validation.status,
    readinessSummary: validation.readinessSummary
  };
}

export async function exportProjectionsUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly projectionWriter: ProjectionWriter;
  readonly projectionReader?: ProjectionReader;
  readonly apply: boolean;
}): Promise<{
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly unchanged: readonly string[];
  readonly humanAuthoredWarnings: readonly ProjectionOverwriteWarning[];
  readonly projections: readonly ProjectionExportEntry[];
  readonly exported?: readonly string[];
}> {
  const graph = await args.graphRepository.load();
  const projections = renderAllProjections(graph);
  const plan = await planProjectionExport(args.projectionReader, projections);

  if (!args.apply) {
    return {
      ...plan,
      dryRun: true,
      applied: false
    };
  }

  const exported = await args.projectionWriter.writeAll(projections);
  return {
    ...plan,
    dryRun: false,
    applied: true,
    exported: exported ?? projections.map((projection) => projection.path)
  };
}

async function planProjectionExport(
  projectionReader: ProjectionReader | undefined,
  projections: readonly RenderedProjection[]
): Promise<{
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly unchanged: readonly string[];
  readonly humanAuthoredWarnings: readonly ProjectionOverwriteWarning[];
  readonly projections: readonly ProjectionExportEntry[];
}> {
  const existingByRequestedPath = new Map<string, ExistingProjectionInput>();
  if (projectionReader?.readExistingMany) {
    for (const existing of await projectionReader.readExistingMany(projections.map((projection) => projection.path))) {
      existingByRequestedPath.set(existing.requestedPath, existing);
    }
  }

  const entries = projections.map((projection) => {
    const existing = existingByRequestedPath.get(projection.path);
    const status: ProjectionExportStatus =
      existing?.content === undefined ? "created" : existing.content === projection.content ? "unchanged" : "updated";
    const humanAuthoredSections =
      status === "updated" && existing?.content !== undefined
        ? detectPossibleHumanAuthoredSections(existing.content, projection.content)
        : [];

    return {
      path: existing?.path ?? projection.path,
      requestedPath: projection.path,
      status,
      humanAuthoredSections
    };
  });

  return {
    created: entries.filter((entry) => entry.status === "created").map((entry) => entry.path),
    updated: entries.filter((entry) => entry.status === "updated").map((entry) => entry.path),
    unchanged: entries.filter((entry) => entry.status === "unchanged").map((entry) => entry.path),
    humanAuthoredWarnings: entries
      .filter((entry) => entry.humanAuthoredSections.length > 0)
      .map((entry) => ({
        path: entry.path,
        sections: entry.humanAuthoredSections,
        reason: "Existing projection content differs from canonical output and may include human-authored Markdown that apply will overwrite."
      })),
    projections: entries
  };
}

function detectPossibleHumanAuthoredSections(existingContent: string, renderedContent: string): readonly string[] {
  const existingSections = markdownSections(existingContent);
  const renderedSections = markdownSections(renderedContent);
  const changedSections = [...existingSections.entries()]
    .filter(([section, content]) => renderedSections.get(section) !== content)
    .map(([section]) => section);

  return changedSections.length === 0 ? ["frontmatter or top-level content"] : changedSections;
}

function markdownSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const matches = [...content.matchAll(/^## (?<title>.+)$/gmu)];
  for (const [index, match] of matches.entries()) {
    const title = match.groups?.title.trim();
    if (!title || match.index === undefined) {
      continue;
    }
    const next = matches[index + 1]?.index ?? content.length;
    sections.set(title, content.slice(match.index, next).trim());
  }
  return sections;
}

export async function initWorkspaceUseCase(
  workspaceInitializer: WorkspaceInitializer
): Promise<{
  readonly status: "initialized";
  readonly entries: readonly WorkspaceInitEntry[];
  readonly created: readonly string[];
  readonly existing: readonly string[];
}> {
  const entries: WorkspaceInitEntry[] = [];

  for (const path of starterDirectories) {
    entries.push({
      path,
      kind: "directory",
      status: await workspaceInitializer.ensureDirectory(path)
    });
  }

  for (const file of starterFiles) {
    entries.push({
      path: file.path,
      kind: "file",
      status: await workspaceInitializer.writeFileIfMissing(file.path, file.content)
    });
  }

  return {
    status: "initialized",
    entries,
    created: entries.filter((entry) => entry.status === "created").map((entry) => entry.path),
    existing: entries.filter((entry) => entry.status === "existing").map((entry) => entry.path)
  };
}

export async function intakeQuestionsUseCase(args: {
  readonly intakeIdeaReader: IntakeIdeaReader;
  readonly path: string;
}): Promise<
  IntakeQuestionSet & {
    readonly sourcePath: string;
    readonly agentPrompt: string;
  }
> {
  const ideaContent = await args.intakeIdeaReader.read(args.path);
  const questionSet = generateIntakeQuestions(ideaContent);

  return {
    sourcePath: args.path,
    ...questionSet,
    agentPrompt:
      "Use the intake idea and grouped questions below to grill me. Ask follow-up questions until the target user, problem, MVP scope, non-goals, constraints, success criteria, and risks/open questions are clear enough to draft a refined brief."
  };
}

export async function refineIntakeBriefUseCase(args: {
  readonly intakeIdeaReader: IntakeIdeaReader;
  readonly refinedBriefWriter: RefinedBriefWriter;
  readonly fromPath: string;
  readonly outPath: string;
  readonly force?: boolean;
}): Promise<{
  readonly status: RefinedBriefWriteStatus;
  readonly created: readonly string[];
  readonly skipped: readonly string[];
  readonly overwritten: readonly string[];
  readonly sourcePath: string;
  readonly outPath: string;
  readonly deferred: true;
  readonly message: string;
}> {
  const sourceContent = await args.intakeIdeaReader.read(args.fromPath);
  const content = renderRefinedBriefScaffold({
    sourcePath: args.fromPath,
    sourceContent
  });
  const status = await args.refinedBriefWriter.write(args.outPath, content, { overwrite: args.force ?? false });

  return {
    status,
    created: status === "created" ? [args.outPath] : [],
    skipped: status === "skipped" ? [args.outPath] : [],
    overwritten: status === "overwritten" ? [args.outPath] : [],
    sourcePath: args.fromPath,
    outPath: args.outPath,
    deferred: true,
    message:
      status === "skipped"
        ? "Refined brief already exists and was left untouched. Pass --force to replace it."
        : "Scaffolded a refined brief with TODO markers. Fill it before graph planning."
  };
}

export async function planFromBriefDryRunUseCase(args: {
  readonly refinedBriefReader: RefinedBriefReader;
  readonly fromPath: string;
}): Promise<{
  readonly status: "proposed";
  readonly dryRun: true;
  readonly sourcePath: string;
  readonly graph: unknown;
  readonly validation: GraphValidationResult;
  readonly scaffoldedFields: readonly string[];
  readonly message: string;
}> {
  const content = await args.refinedBriefReader.read(args.fromPath);
  const proposal = proposePlanningGraphFromBrief({
    sourcePath: args.fromPath,
    content
  });
  const validation = validatePlanningGraph(proposal.graph);

  return {
    status: "proposed",
    dryRun: true,
    sourcePath: args.fromPath,
    graph: serializePlanningGraphJson(proposal.graph),
    validation,
    scaffoldedFields: proposal.scaffoldedFields,
    message: "Dry run only. No planning files were written; review this graph before a future apply step."
  };
}

export async function planFromBriefApplyUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly refinedBriefReader: RefinedBriefReader;
  readonly changeLogWriter: ChangeLogWriter;
  readonly fromPath: string;
  readonly actor?: string;
  readonly timestamp?: string;
}): Promise<{
  readonly status: "applied";
  readonly dryRun: false;
  readonly applied: true;
  readonly sourcePath: string;
  readonly graph: unknown;
  readonly validation: GraphValidationResult;
  readonly scaffoldedFields: readonly string[];
  readonly event: PlanningChangeLogEvent;
  readonly message: string;
}> {
  if (!args.graphRepository.save) {
    throw new Error("Applying a plan requires a writable graph repository.");
  }

  const existingGraph = args.graphRepository.loadIfExists ? await args.graphRepository.loadIfExists() : await args.graphRepository.load();
  const existingGraphIsNonEmpty = Boolean(existingGraph && !isEmptyPlanningGraph(existingGraph));
  if (existingGraphIsNonEmpty) {
    throw new Error("Refusing to overwrite existing non-empty planning/graph.json without an explicit force/update path.");
  }

  const content = await args.refinedBriefReader.read(args.fromPath);
  const proposal = proposePlanningGraphFromBrief({
    sourcePath: args.fromPath,
    content
  });
  const validation = validatePlanningGraph(proposal.graph);
  if (validation.status === "error") {
    throw new Error("Proposed graph failed validation and was not applied.");
  }

  const event = createChangeLogEvent({
    graphVersionBefore: 0,
    graphVersionAfter: proposal.graph.graphVersion,
    affectedNodeIds: proposal.graph.nodes.map((node) => node.id),
    actor: args.actor ?? "planner",
    timestamp: args.timestamp ?? new Date().toISOString(),
    operationType: "graph_creation_from_brief",
    approvalStatus: "applied",
    summary: `Created planning graph from refined brief ${args.fromPath}.`,
    provenanceReference: `planner plan --from ${args.fromPath} --apply`
  });

  await args.changeLogWriter.append(event);
  await args.graphRepository.save(proposal.graph);

  return {
    status: "applied",
    dryRun: false,
    applied: true,
    sourcePath: args.fromPath,
    graph: serializePlanningGraphJson(proposal.graph),
    validation,
    scaffoldedFields: proposal.scaffoldedFields,
    event,
    message: "Applied graph proposal to planning/graph.json and recorded planning/change-log.ndjson."
  };
}

export async function reconcileGraphUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly projectionReader: ProjectionReader;
  readonly changeLogWriter?: ChangeLogWriter;
  readonly apply: boolean;
  readonly actor?: string;
  readonly timestamp?: string;
}): Promise<
  ReconciliationResult & {
    readonly applied: boolean;
    readonly event?: PlanningChangeLogEvent;
  }
> {
  const graph = await args.graphRepository.load();
  const projections = await args.projectionReader.readMany(workItemProjectionPaths(graph));
  const reconciliation = reconcileGraphProjections(graph, projections);

  if (!args.apply || reconciliation.proposedPatches.length === 0 || reconciliation.conflicts.length > 0) {
    return { ...reconciliation, applied: false };
  }

  if (!args.graphRepository.save) {
    throw new Error("Applying reconciliation requires a writable graph repository.");
  }

  if (!args.changeLogWriter) {
    throw new Error("Applying reconciliation requires a planning change log writer.");
  }

  const updatedGraph = applyGraphPatches(graph, reconciliation.proposedPatches);
  const validation = validatePlanningGraph(updatedGraph);
  if (validation.status === "error") {
    return {
      ...reconciliation,
      applied: false,
      conflicts: [
        ...reconciliation.conflicts,
        ...validation.semanticErrors.map((error) => ({
          nodeId: String(error.nodeId ?? error.edge?.source ?? "graph"),
          field: "graph_validation",
          reason: error.message,
          sourcePath: "planning/graph.json"
        }))
      ]
    };
  }

  const event = createChangeLogEvent({
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: updatedGraph.graphVersion,
    affectedNodeIds: [...new Set(reconciliation.proposedPatches.map((patch) => patch.nodeId))],
    actor: args.actor ?? "planner",
    timestamp: args.timestamp ?? new Date().toISOString(),
    operationType: "reconciliation_apply",
    approvalStatus: "applied",
    summary: `Applied ${reconciliation.proposedPatches.length} safe reconciliation patch(es).`,
    provenanceReference: "planner reconcile --apply"
  });

  await args.changeLogWriter.append(event);
  await args.graphRepository.save(updatedGraph);

  return {
    ...reconciliation,
    graphVersion: updatedGraph.graphVersion,
    applied: true,
    event
  };
}

export function createChangeLogEvent(args: {
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly affectedNodeIds: readonly string[];
  readonly actor: string;
  readonly timestamp: string;
  readonly operationType: string;
  readonly approvalStatus?: string;
  readonly summary: string;
  readonly provenanceReference?: string;
}): PlanningChangeLogEvent {
  return {
    event_id: `evt-${args.timestamp.replace(/[^0-9]/g, "").slice(0, 14)}-${args.graphVersionAfter}`,
    timestamp: args.timestamp,
    graph_version_before: args.graphVersionBefore,
    graph_version_after: args.graphVersionAfter,
    actor: args.actor,
    operation_type: args.operationType,
    affected_node_ids: args.affectedNodeIds,
    approval_status: args.approvalStatus,
    summary: args.summary,
    provenance_reference: args.provenanceReference
  };
}

function isEmptyPlanningGraph(graph: PlanningGraph): boolean {
  return graph.nodes.length === 0 && graph.edges.length === 0;
}

const starterDirectories = [
  "planning",
  "planning/intake",
  "planning/work-items",
  "planning/execution-slices",
  "docs/prd",
  "docs/rfc",
  "docs/architecture"
] as const;

const starterFiles = [
  {
    path: "planning/intake/idea.md",
    content: intakeBriefTemplate
  },
  {
    path: "planning/change-log.ndjson",
    content: ""
  },
  {
    path: "planning/graph.json",
    content: `${JSON.stringify(
      {
        schema_version: "0.1.0",
        graph_version: 1,
        generated_at: "2026-05-29T00:00:00+10:00",
        source: "starter-workspace",
        nodes: {
          requirements: [],
          decisions: [],
          assumptions: [],
          risks: [],
          open_questions: [],
          hitl_gates: [],
          components: [],
          work_items: [],
          document_projections: [],
          execution_slices: []
        },
        edges: []
      },
      null,
      2
    )}\n`
  }
] as const;
