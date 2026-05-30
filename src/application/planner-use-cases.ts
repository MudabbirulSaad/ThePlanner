import {
  applyGraphPatches,
  applyGraphOperationToCandidate,
  currentPlanningGraphSchemaVersion,
  generateIntakeQuestions,
  proposePlanningGraphFromBrief,
  reconciliationProjectionPaths,
  renderRefinedBriefScaffold,
  reconcileGraphProjections,
  renderAllProjections,
  validatePlanningGraph,
} from "../core/index.js";
import type {
  GraphValidationResult,
  IntakeQuestionSet,
  PlanningGraph,
  ProjectionInput,
  ProposedGraphOperation,
  ReconciliationResult,
  RenderedProjection,
  WorkItemNode
} from "../core/index.js";
import { graphSchemaTemplate } from "../templates/graph-schema-template.js";
import { intakeBriefTemplate } from "../templates/intake-brief-template.js";
import {
  buildAgentContextSections,
  renderAgentContextBundle,
  renderAgentContextMarkdown,
  selectExecutionSliceContext,
  validationCommandsForWorkItem
} from "./agent-context-bundle.js";
import type { AgentContextBundleSection, ContextFileReader, ExecutionSliceContextSelection, SupportedAgent } from "./agent-context-bundle.js";
import {
  parseProposedGraphOperationJson,
  parseProposedGraphOperationProposalJson
} from "./graph-operation-schema.js";
import { parsePlanningGraphJson, serializePlanningGraphJson } from "./graph-json.js";

export interface GraphRepository {
  readonly load: () => Promise<PlanningGraph>;
  readonly loadJson?: () => Promise<unknown>;
  readonly loadIfExists?: () => Promise<PlanningGraph | undefined>;
  readonly save?: (graph: PlanningGraph) => Promise<void>;
}

export type RunnableSchemaValidationStatus = Exclude<GraphValidationResult["schemaStatus"], "not_run" | "warning">;

export interface SchemaValidationReport {
  readonly status: RunnableSchemaValidationStatus;
  readonly errors: GraphValidationResult["schemaErrors"];
}

export interface JsonSchemaValidator {
  readonly validate: (value: unknown) => Promise<SchemaValidationReport> | SchemaValidationReport;
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

export interface GraphOperationProposalReader {
  readonly readJson: (path: string) => Promise<unknown>;
}

export interface GraphOperationUserAnswerReader {
  readonly readJson: (path: string) => Promise<unknown>;
}

interface ParsedGraphOperationProposal {
  readonly operation: ProposedGraphOperation;
  readonly approved: boolean;
}

export interface GraphOperationUserAnswerInput {
  readonly questionId?: string;
  readonly question?: string;
  readonly answer: string;
  readonly sourceReference?: string;
}

export interface GraphOperationProposerInput {
  readonly graph: PlanningGraph;
  readonly intakeBrief?: {
    readonly sourcePath: string;
    readonly content: string;
  };
  readonly userAnswers?: readonly GraphOperationUserAnswerInput[];
}

export interface GraphOperationProposerProposal {
  readonly operation: unknown;
  readonly sourceReference?: string;
  readonly rationale?: string;
}

export interface GraphOperationProposerResult {
  readonly proposals: readonly GraphOperationProposerProposal[];
}

export interface GraphOperationProposer {
  readonly propose: (input: GraphOperationProposerInput) => Promise<GraphOperationProposerResult> | GraphOperationProposerResult;
}

export interface ReviewerGraphOperationProposerInput {
  readonly graphContext: ExecutionSliceContextSelection;
  readonly run: {
    readonly runId: string;
    readonly runDirectory: string;
    readonly workItemId: string;
    readonly agent: RunnableAgent;
    readonly graphVersion: number;
    readonly generatedAt: string;
    readonly validation: AgentRunValidationSummary;
    readonly runner: AgentExecutionResult["runner"];
    readonly changedFiles: readonly string[];
    readonly artifacts: readonly string[];
  };
}

export interface ReviewerGraphOperationProposer {
  readonly propose: (
    input: ReviewerGraphOperationProposerInput
  ) => Promise<GraphOperationProposerResult> | GraphOperationProposerResult;
}

export interface GraphOperationProposalSummary {
  readonly sourcePath: string;
  readonly operation: string;
  readonly approvalRequired: boolean;
  readonly approvalCategory: string;
  readonly affectedNodeIds: readonly string[];
  readonly openQuestion?: {
    readonly id: string;
    readonly title: string;
    readonly question: string;
    readonly priority: string;
    readonly blocksExecution: boolean;
  };
}

export type RefinedBriefWriteStatus = "created" | "overwritten" | "skipped";

export interface RefinedBriefWriter {
  readonly write: (path: string, content: string, options?: { readonly overwrite?: boolean }) => Promise<RefinedBriefWriteStatus>;
}

export interface AgentRunArtifactFile {
  readonly path: string;
  readonly content: string;
}

export interface AgentRunArtifactWriter {
  readonly writeAll: (files: readonly AgentRunArtifactFile[]) => Promise<readonly string[] | void>;
}

export interface AgentRunArtifactReader {
  readonly read: (path: string) => Promise<string>;
}

export type RunnableAgent = SupportedAgent;
export type SupportedTracker = "github";

export interface AgentRunnerInput {
  readonly agent: RunnableAgent;
  readonly workItemId: string;
  readonly runId: string;
  readonly prompt: string;
  readonly runDirectory: string;
}

export interface AgentRunnerError {
  readonly code: string;
  readonly message: string;
}

export interface ProcessOutputSummary {
  readonly stdoutBytes: number;
  readonly stderrBytes: number;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
  readonly outputLimitBytes: number;
}

export interface AgentRunnerResult {
  readonly command: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output?: ProcessOutputSummary;
  readonly error?: AgentRunnerError;
}

export interface AgentRunner {
  readonly run: (input: AgentRunnerInput) => Promise<AgentRunnerResult>;
}

export interface ValidationCommandRunnerInput {
  readonly command: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly runDirectory: string;
}

export interface ValidationCommandResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly output?: ProcessOutputSummary;
  readonly error?: AgentRunnerError;
}

export interface ValidationCommandRunner {
  readonly run: (input: ValidationCommandRunnerInput) => Promise<ValidationCommandResult>;
}

export interface TrackerIssueProposal {
  readonly workItemId: string;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly dependencies: readonly string[];
  readonly references: readonly string[];
}

export interface TrackerSyncPreviewInput {
  readonly graph: PlanningGraph;
}

export interface TrackerSyncPreview {
  readonly issues: readonly TrackerIssueProposal[];
}

export interface TrackerSyncAdapter {
  readonly tracker: SupportedTracker;
  readonly preview: (input: TrackerSyncPreviewInput) => Promise<TrackerSyncPreview> | TrackerSyncPreview;
}

export interface RepoScanCommand {
  readonly name: string;
  readonly command: string;
  readonly sourcePath: string;
}

export interface RepoScanDocument {
  readonly path: string;
  readonly title: string | null;
  readonly headings: readonly string[];
}

export interface RepoScanComponent {
  readonly path: string;
  readonly kind: string;
}

export interface RepoScanContext {
  readonly rootPath: string;
  readonly projectTypes: readonly string[];
  readonly commands: readonly RepoScanCommand[];
  readonly relevantDocs: readonly RepoScanDocument[];
  readonly planningFiles: readonly string[];
  readonly components: readonly RepoScanComponent[];
  readonly ignoredDirectories: readonly string[];
  readonly scannedFiles: readonly string[];
}

export interface RepoScanner {
  readonly scan: () => Promise<RepoScanContext>;
}

export interface TrackerSyncDryRunResult {
  readonly status: "planned";
  readonly tracker: SupportedTracker;
  readonly dryRun: true;
  readonly applied: false;
  readonly proposedIssues: readonly TrackerIssueProposal[];
  readonly message: string;
}

export interface AgentRunValidationSummary {
  readonly status: "pass" | "fail";
  readonly commands: readonly {
    readonly command: string;
    readonly exitCode: number;
    readonly output?: ProcessOutputSummary;
    readonly error?: AgentRunnerError;
  }[];
}

export interface AgentContextBundleResult {
  readonly status: "prepared";
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly agent: SupportedAgent;
  readonly workItemId: string;
  readonly runId: string | null;
  readonly bundlePath: string | null;
  readonly artifactPaths: readonly string[];
  readonly createdPaths: readonly string[];
  readonly metadata: AgentRunMetadata | null;
  readonly readiness: {
    readonly labels: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly validationCommands: readonly string[];
  readonly context: readonly AgentContextBundleSection[];
  readonly content: string;
  readonly message: string;
}

export interface AgentRunMetadata {
  readonly runId: string;
  readonly workItemId: string;
  readonly graphVersion: number;
  readonly agent: SupportedAgent;
  readonly generatedAt: string;
  readonly validationCommands: readonly string[];
}

export interface AgentExecutionRunMetadata extends AgentRunMetadata {
  readonly agent: RunnableAgent;
  readonly validation: AgentRunValidationSummary;
}

export interface AgentExecutionResult {
  readonly status: "completed" | "failed";
  readonly agent: RunnableAgent;
  readonly workItemId: string;
  readonly runId: string;
  readonly runDirectory: string;
  readonly bundlePath: string;
  readonly artifactPaths: readonly string[];
  readonly createdPaths: readonly string[];
  readonly metadata: AgentExecutionRunMetadata;
  readonly readiness: {
    readonly labels: readonly string[];
    readonly reasons: readonly string[];
  };
  readonly validationCommands: readonly string[];
  readonly validation: AgentRunValidationSummary;
  readonly runner: {
    readonly command: readonly string[];
    readonly exitCode: number;
    readonly output?: ProcessOutputSummary;
    readonly error?: AgentRunnerError;
  };
  readonly message: string;
}

export interface AgentRunReviewResult {
  readonly status: "ready_for_review";
  readonly runId: string;
  readonly runDirectory: string;
  readonly workItem: {
    readonly id: string;
    readonly title?: string;
  };
  readonly agent: RunnableAgent;
  readonly graphVersion: number;
  readonly generatedAt: string;
  readonly changedFiles: readonly string[];
  readonly runner: {
    readonly command: readonly string[];
    readonly exitCode: number;
    readonly output?: ProcessOutputSummary;
    readonly error?: AgentRunnerError;
  };
  readonly validation: AgentRunValidationSummary;
  readonly artifacts: readonly string[];
  readonly message: string;
}

export interface AgentRunReviewerProposalResult {
  readonly status: "candidate" | "rejected";
  readonly dryRun: true;
  readonly applied: false;
  readonly runId: string;
  readonly runDirectory: string;
  readonly workItem: {
    readonly id: string;
    readonly title?: string;
  };
  readonly runStatus: "passed" | "failed";
  readonly proposalCount: number;
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly proposedOperations: readonly GraphOperationProposalSummary[];
  readonly results: readonly GraphOperationDryRunResult[];
  readonly candidateGraph?: unknown;
  readonly validation: GraphValidationResult;
  readonly message: string;
}

export interface AgentRunDecisionResult {
  readonly status: "accepted" | "rejected";
  readonly runId: string;
  readonly workItemId: string;
  readonly event: PlanningChangeLogEvent;
  readonly message: string;
}

export interface GraphOperationDryRunResult {
  readonly status: "candidate" | "rejected";
  readonly dryRun: true;
  readonly applied: false;
  readonly sourcePath: string;
  readonly operation: string;
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly approvalRequired: boolean;
  readonly approvalCategory: string;
  readonly approvalRationale: string;
  readonly affectedNodeIds: readonly string[];
  readonly candidateGraph?: unknown;
  readonly operationErrors: readonly {
    readonly code: string;
    readonly message: string;
    readonly nodeId?: string;
  }[];
  readonly validation: GraphValidationResult;
  readonly message: string;
}

export interface ValidateGraphUseCaseResult {
  readonly validation: GraphValidationResult;
  readonly exitCode: number;
}

export async function validateGraphUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly schemaValidator?: JsonSchemaValidator;
}): Promise<ValidateGraphUseCaseResult> {
  const rawGraph =
    args.schemaValidator && args.graphRepository.loadJson
      ? await loadGraphJsonForSchemaValidation(args.graphRepository)
      : undefined;
  if (isJsonLoadFailure(rawGraph)) {
    const validation: GraphValidationResult = {
      graphVersion: 0,
      status: "error",
      schemaStatus: "error",
      schemaErrors: [
        {
          code: "invalid_json",
          message: rawGraph.message
        }
      ],
      semanticErrors: [],
      semanticWarnings: [],
      readinessSummary: emptyReadinessSummary(),
      readinessSnapshots: {}
    };

    return {
      validation,
      exitCode: 1
    };
  }

  const schemaReport = rawGraph === undefined ? undefined : await validateGraphJsonSchema(args.schemaValidator, rawGraph);

  if (schemaReport?.status === "error") {
    const validation: GraphValidationResult = {
      graphVersion: graphVersionFromJson(rawGraph),
      status: "error",
      schemaStatus: "error",
      schemaErrors: schemaReport.errors,
      semanticErrors: [],
      semanticWarnings: [],
      readinessSummary: emptyReadinessSummary(),
      readinessSnapshots: {}
    };

    return {
      validation,
      exitCode: 1
    };
  }

  const validation = validatePlanningGraph(rawGraph === undefined ? await args.graphRepository.load() : parsePlanningGraphJson(rawGraph));
  const validationWithSchema: GraphValidationResult = schemaReport
    ? { ...validation, schemaStatus: schemaReport.status, schemaErrors: schemaReport.errors }
    : validation;

  return {
    validation: validationWithSchema,
    exitCode: validationWithSchema.status === "error" ? 1 : 0
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

export async function syncTrackerDryRunUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly trackerAdapter: TrackerSyncAdapter;
}): Promise<TrackerSyncDryRunResult> {
  const graph = await args.graphRepository.load();
  const preview = await args.trackerAdapter.preview({ graph });

  return {
    status: "planned",
    tracker: args.trackerAdapter.tracker,
    dryRun: true,
    applied: false,
    proposedIssues: preview.issues,
    message: `Dry run planned ${preview.issues.length} ${args.trackerAdapter.tracker} issue(s). No external tracker was mutated.`
  };
}

export async function repoScanDryRunUseCase(args: {
  readonly repoScanner: RepoScanner;
}): Promise<
  RepoScanContext & {
    readonly status: "scanned";
    readonly dryRun: true;
    readonly applied: false;
    readonly message: string;
  }
> {
  const context = await args.repoScanner.scan();

  return {
    status: "scanned",
    dryRun: true,
    applied: false,
    ...context,
    message: `Dry run scanned ${context.scannedFiles.length} repository context file(s). No planning graph or projection files were written.`
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
    provenanceReference: `theplanner plan --from ${args.fromPath} --apply`
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

export async function graphOperationDryRunUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly proposalReader: GraphOperationProposalReader;
  readonly fromPath: string;
}): Promise<GraphOperationDryRunResult> {
  const graph = await args.graphRepository.load();
  const { operation } = parseGraphOperationProposal(await args.proposalReader.readJson(args.fromPath));
  return dryRunGraphOperationCandidate({
    graph,
    operation,
    sourcePath: args.fromPath
  });
}

export async function proposeGraphOperationsUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly proposer: GraphOperationProposer;
  readonly intakeBrief?: {
    readonly sourcePath: string;
    readonly content: string;
  };
  readonly userAnswers?: readonly GraphOperationUserAnswerInput[];
}): Promise<{
  readonly status: "candidate" | "rejected";
  readonly dryRun: true;
  readonly applied: false;
  readonly proposalCount: number;
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly proposedOperations: readonly GraphOperationProposalSummary[];
  readonly results: readonly GraphOperationDryRunResult[];
  readonly candidateGraph?: unknown;
  readonly validation: GraphValidationResult;
  readonly message: string;
}> {
  const graph = await args.graphRepository.load();
  const proposerResult = await args.proposer.propose({
    graph: deepCloneApplicationValue(graph),
    ...(args.intakeBrief ? { intakeBrief: deepCloneApplicationValue(args.intakeBrief) } : {}),
    ...(args.userAnswers ? { userAnswers: deepCloneApplicationValue(args.userAnswers) } : {})
  });
  const results: GraphOperationDryRunResult[] = [];
  const proposedOperations: GraphOperationProposalSummary[] = [];
  let candidateGraph = deepCloneApplicationValue(graph);

  for (const [index, proposal] of proposerResult.proposals.entries()) {
    const sourcePath = proposal.sourceReference ?? args.intakeBrief?.sourcePath ?? `graph-operation-proposer#${index + 1}`;
    let parsedOperation: ProposedGraphOperation;
    try {
      parsedOperation = parseProposedGraphOperationJson(proposal.operation);
    } catch (error) {
      const result = rejectedGraphOperationParseResult({
        graph: candidateGraph,
        sourcePath,
        error
      });
      results.push(result);

      return {
        status: "rejected",
        dryRun: true,
        applied: false,
        proposalCount: proposerResult.proposals.length,
        graphVersionBefore: graph.graphVersion,
        graphVersionAfter: candidateGraph.graphVersion,
        proposedOperations,
        results,
        validation: validatePlanningGraph(candidateGraph),
        message: "At least one proposed Graph Operation was rejected. No planning files were written."
      };
    }
    const result = dryRunGraphOperationCandidate({
      graph: candidateGraph,
      operation: parsedOperation,
      sourcePath
    });
    results.push(result);
    proposedOperations.push(summarizeProposedOperation(sourcePath, parsedOperation, result));

    if (result.status === "rejected") {
      return {
        status: "rejected",
        dryRun: true,
        applied: false,
        proposalCount: proposerResult.proposals.length,
        graphVersionBefore: graph.graphVersion,
        graphVersionAfter: candidateGraph.graphVersion,
        proposedOperations,
        results,
        validation: validatePlanningGraph(candidateGraph),
        message: "At least one proposed Graph Operation was rejected. No planning files were written."
      };
    }

    candidateGraph = parsePlanningGraphJson(result.candidateGraph);
  }

  return {
    status: "candidate",
    dryRun: true,
    applied: false,
    proposalCount: proposerResult.proposals.length,
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: candidateGraph.graphVersion,
    proposedOperations,
    results,
    candidateGraph: serializePlanningGraphJson(candidateGraph),
    validation: validatePlanningGraph(candidateGraph),
    message: "Dry run only. Proposed Graph Operations were applied to a validated candidate graph; no planning files were written."
  };
}

export async function grillingSessionDryRunUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly refinedBriefReader: RefinedBriefReader;
  readonly proposer: GraphOperationProposer;
  readonly fromPath: string;
  readonly userAnswerReader?: GraphOperationUserAnswerReader;
  readonly answersPath?: string;
}): Promise<{
  readonly status: "candidate" | "rejected";
  readonly dryRun: true;
  readonly applied: false;
  readonly sourcePath: string;
  readonly answersPath?: string;
  readonly proposalCount: number;
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly proposedOperations: readonly GraphOperationProposalSummary[];
  readonly proposedOpenQuestions: readonly NonNullable<GraphOperationProposalSummary["openQuestion"]>[];
  readonly results: readonly GraphOperationDryRunResult[];
  readonly candidateGraph?: unknown;
  readonly validation: GraphValidationResult;
  readonly message: string;
}> {
  if (args.answersPath && !args.userAnswerReader) {
    throw new Error("Grilling session answers require a user answer reader.");
  }

  const intakeBrief = {
    sourcePath: args.fromPath,
    content: await args.refinedBriefReader.read(args.fromPath)
  };
  const userAnswers = args.answersPath
    ? parseGraphOperationUserAnswers(await args.userAnswerReader!.readJson(args.answersPath), args.answersPath)
    : undefined;
  const result = await proposeGraphOperationsUseCase({
    graphRepository: args.graphRepository,
    proposer: args.proposer,
    intakeBrief,
    ...(userAnswers ? { userAnswers } : {})
  });

  return {
    ...result,
    sourcePath: args.fromPath,
    ...(args.answersPath ? { answersPath: args.answersPath } : {}),
    proposedOpenQuestions: result.proposedOperations.flatMap((operation) =>
      operation.openQuestion ? [operation.openQuestion] : []
    ),
    message:
      result.status === "candidate"
        ? "Dry run only. Grilling proposals were applied to a validated candidate graph; no planning files were written."
        : result.message
  };
}

function rejectedGraphOperationParseResult(args: {
  readonly graph: PlanningGraph;
  readonly sourcePath: string;
  readonly error: unknown;
}): GraphOperationDryRunResult {
  return {
    status: "rejected",
    dryRun: true,
    applied: false,
    sourcePath: args.sourcePath,
    operation: "InvalidProposal",
    graphVersionBefore: args.graph.graphVersion,
    graphVersionAfter: args.graph.graphVersion,
    approvalRequired: false,
    approvalCategory: "none",
    approvalRationale: "Operation was rejected before approval classification.",
    affectedNodeIds: [],
    operationErrors: [
      {
        code: "graph_operation_proposal_invalid",
        message: args.error instanceof Error ? args.error.message : String(args.error)
      }
    ],
    validation: validatePlanningGraph(args.graph),
    message: "Proposed Graph Operation could not be parsed. No planning files were written."
  };
}

function rejectedReviewerPolicyResult(args: {
  readonly graph: PlanningGraph;
  readonly sourcePath: string;
  readonly operation: ProposedGraphOperation;
  readonly message: string;
}): GraphOperationDryRunResult {
  return {
    status: "rejected",
    dryRun: true,
    applied: false,
    sourcePath: args.sourcePath,
    operation: args.operation.kind,
    graphVersionBefore: args.graph.graphVersion,
    graphVersionAfter: args.graph.graphVersion,
    approvalRequired: false,
    approvalCategory: "none",
    approvalRationale: "Operation was rejected by reviewer proposal policy.",
    affectedNodeIds: affectedNodeIdsForGraphOperation(args.operation),
    operationErrors: [
      {
        code: "reviewer_failure_requires_blocker",
        message: args.message
      }
    ],
    validation: validatePlanningGraph(args.graph),
    message: "Reviewer Graph Operation was rejected before candidate validation. No planning files were written."
  };
}

function rejectedAgentRunReviewerProposalResult(args: {
  readonly graph: PlanningGraph;
  readonly candidateGraph: PlanningGraph;
  readonly summary: LoadedAgentRunSummary;
  readonly workItem: WorkItemNode;
  readonly runStatus: "passed" | "failed";
  readonly proposalCount: number;
  readonly proposedOperations: readonly GraphOperationProposalSummary[];
  readonly results: readonly GraphOperationDryRunResult[];
  readonly message: string;
}): AgentRunReviewerProposalResult {
  return {
    status: "rejected",
    dryRun: true,
    applied: false,
    runId: args.summary.metadata.runId,
    runDirectory: args.summary.runDirectory,
    workItem: {
      id: args.workItem.id,
      title: args.workItem.title
    },
    runStatus: args.runStatus,
    proposalCount: args.proposalCount,
    graphVersionBefore: args.graph.graphVersion,
    graphVersionAfter: args.candidateGraph.graphVersion,
    proposedOperations: args.proposedOperations,
    results: args.results,
    validation: validatePlanningGraph(args.candidateGraph),
    message: args.message
  };
}

function summarizeProposedOperation(
  sourcePath: string,
  operation: ProposedGraphOperation,
  result: GraphOperationDryRunResult
): GraphOperationProposalSummary {
  return {
    sourcePath,
    operation: operation.kind,
    approvalRequired: result.approvalRequired,
    approvalCategory: result.approvalCategory,
    affectedNodeIds: result.affectedNodeIds,
    ...(operation.kind === "AddOpenQuestion"
      ? {
          openQuestion: {
            id: operation.openQuestion.id,
            title: operation.openQuestion.title,
            question: operation.openQuestion.question,
            priority: operation.openQuestion.priority,
            blocksExecution: operation.openQuestion.blocksExecution
          }
        }
      : {})
  };
}

function dryRunGraphOperationCandidate(args: {
  readonly graph: PlanningGraph;
  readonly operation: ProposedGraphOperation;
  readonly sourcePath: string;
}): GraphOperationDryRunResult {
  const graph = args.graph;
  const operation = args.operation;
  const applyResult = applyGraphOperationToCandidate(graph, operation);
  const affectedNodeIds = affectedNodeIdsForGraphOperation(operation);

  if (applyResult.status === "rejected") {
    return {
      status: "rejected",
      dryRun: true,
      applied: false,
      sourcePath: args.sourcePath,
      operation: operation.kind,
      graphVersionBefore: graph.graphVersion,
      graphVersionAfter: graph.graphVersion,
      approvalRequired: false,
      approvalCategory: "none",
      approvalRationale: "Operation was rejected before approval classification.",
      affectedNodeIds,
      operationErrors: applyResult.errors,
      validation: validatePlanningGraph(graph),
      message: "Proposed Graph Operation was rejected before candidate validation. No planning files were written."
    };
  }

  const validation = validatePlanningGraph(applyResult.candidateGraph);
  if (validation.status === "error") {
    return {
      status: "rejected",
      dryRun: true,
      applied: false,
      sourcePath: args.sourcePath,
      operation: operation.kind,
      graphVersionBefore: graph.graphVersion,
      graphVersionAfter: applyResult.candidateGraph.graphVersion,
      approvalRequired: applyResult.approval.required,
      approvalCategory: applyResult.approval.category,
      approvalRationale: applyResult.approval.rationale,
      affectedNodeIds,
      candidateGraph: serializePlanningGraphJson(applyResult.candidateGraph),
      operationErrors: validation.semanticErrors.map((error) => ({
        code: error.code,
        message: error.message,
        ...(error.nodeId ? { nodeId: String(error.nodeId) } : {})
      })),
      validation,
      message: "Candidate graph failed validation. No planning files were written."
    };
  }

  return {
    status: "candidate",
    dryRun: true,
    applied: false,
    sourcePath: args.sourcePath,
    operation: operation.kind,
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: applyResult.candidateGraph.graphVersion,
    approvalRequired: applyResult.approval.required,
    approvalCategory: applyResult.approval.category,
    approvalRationale: applyResult.approval.rationale,
    affectedNodeIds,
    candidateGraph: serializePlanningGraphJson(applyResult.candidateGraph),
    operationErrors: [],
    validation,
    message: "Dry run only. Proposed Graph Operation was applied to a validated candidate graph; no planning files were written."
  };
}

export async function graphOperationApplyUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly proposalReader: GraphOperationProposalReader;
  readonly changeLogWriter: ChangeLogWriter;
  readonly fromPath: string;
  readonly approved?: boolean;
  readonly actor?: string;
  readonly timestamp?: string;
}): Promise<{
  readonly status: "applied" | "rejected";
  readonly dryRun: false;
  readonly applied: boolean;
  readonly sourcePath: string;
  readonly operation: string;
  readonly graphVersionBefore: number;
  readonly graphVersionAfter: number;
  readonly approvalRequired: boolean;
  readonly approvalCategory: string;
  readonly approvalRationale: string;
  readonly approvalStatus: "not_required" | "approved" | "missing" | "rejected_before_classification";
  readonly affectedNodeIds: readonly string[];
  readonly operationErrors: readonly {
    readonly code: string;
    readonly message: string;
    readonly nodeId?: string;
  }[];
  readonly validation: GraphValidationResult;
  readonly graph?: unknown;
  readonly event?: PlanningChangeLogEvent;
  readonly message: string;
}> {
  const graph = await args.graphRepository.load();
  const proposal = parseGraphOperationProposal(await args.proposalReader.readJson(args.fromPath));
  const applyResult = applyGraphOperationToCandidate(graph, proposal.operation);
  const affectedNodeIds = affectedNodeIdsForGraphOperation(proposal.operation);

  if (applyResult.status === "rejected") {
    return {
      status: "rejected",
      dryRun: false,
      applied: false,
      sourcePath: args.fromPath,
      operation: proposal.operation.kind,
      graphVersionBefore: graph.graphVersion,
      graphVersionAfter: graph.graphVersion,
      approvalRequired: false,
      approvalCategory: "none",
      approvalRationale: "Operation was rejected before approval classification.",
      approvalStatus: "rejected_before_classification",
      affectedNodeIds,
      operationErrors: applyResult.errors,
      validation: validatePlanningGraph(graph),
      message: "Proposed Graph Operation was rejected before candidate validation. No planning files were written."
    };
  }

  const validation = validatePlanningGraph(applyResult.candidateGraph);
  if (validation.status === "error") {
    return {
      status: "rejected",
      dryRun: false,
      applied: false,
      sourcePath: args.fromPath,
      operation: proposal.operation.kind,
      graphVersionBefore: graph.graphVersion,
      graphVersionAfter: applyResult.candidateGraph.graphVersion,
      approvalRequired: applyResult.approval.required,
      approvalCategory: applyResult.approval.category,
      approvalRationale: applyResult.approval.rationale,
      approvalStatus: applyResult.approval.required ? "missing" : "not_required",
      affectedNodeIds,
      operationErrors: validation.semanticErrors.map((error) => ({
        code: error.code,
        message: error.message,
        ...(error.nodeId ? { nodeId: String(error.nodeId) } : {})
      })),
      validation,
      message: "Candidate graph failed validation. No planning files were written."
    };
  }

  const approved = proposal.approved || args.approved === true;
  if (applyResult.approval.required && !approved) {
    return {
      status: "rejected",
      dryRun: false,
      applied: false,
      sourcePath: args.fromPath,
      operation: proposal.operation.kind,
      graphVersionBefore: graph.graphVersion,
      graphVersionAfter: applyResult.candidateGraph.graphVersion,
      approvalRequired: true,
      approvalCategory: applyResult.approval.category,
      approvalRationale: applyResult.approval.rationale,
      approvalStatus: "missing",
      affectedNodeIds,
      operationErrors: [
        {
          code: "graph_operation_approval_required",
          message: "Graph Operation requires explicit approval via proposal approved=true or --approved before --apply."
        }
      ],
      validation,
      message: "Approval-required Graph Operation was refused. No planning files were written."
    };
  }

  if (!args.graphRepository.save) {
    throw new Error("Applying Graph Operation requires a writable graph repository.");
  }

  const approvalStatus = applyResult.approval.required ? "approved" : "not_required";
  const event = createChangeLogEvent({
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: applyResult.candidateGraph.graphVersion,
    affectedNodeIds,
    actor: args.actor ?? "planner",
    timestamp: args.timestamp ?? new Date().toISOString(),
    operationType: proposal.operation.kind,
    approvalStatus,
    summary: `Applied ${proposal.operation.kind} from ${args.fromPath}.`,
    provenanceReference: `theplanner graph-operation --from ${args.fromPath} --apply`
  });

  await args.changeLogWriter.append(event);
  await args.graphRepository.save(applyResult.candidateGraph);

  return {
    status: "applied",
    dryRun: false,
    applied: true,
    sourcePath: args.fromPath,
    operation: proposal.operation.kind,
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: applyResult.candidateGraph.graphVersion,
    approvalRequired: applyResult.approval.required,
    approvalCategory: applyResult.approval.category,
    approvalRationale: applyResult.approval.rationale,
    approvalStatus,
    affectedNodeIds,
    operationErrors: [],
    validation,
    graph: serializePlanningGraphJson(applyResult.candidateGraph),
    event,
    message: "Applied Graph Operation to planning/graph.json and recorded planning/change-log.ndjson."
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
  const projections = await args.projectionReader.readMany(reconciliationProjectionPaths(graph));
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
    provenanceReference: "theplanner reconcile --apply"
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

export async function prepareAgentContextBundleUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly contextFileReader: ContextFileReader;
  readonly runArtifactWriter?: AgentRunArtifactWriter;
  readonly workItemId: string;
  readonly agent: string;
  readonly defaultValidationCommands?: readonly string[];
  readonly apply?: boolean;
  readonly timestamp?: string;
}): Promise<AgentContextBundleResult> {
  const agent = parseSupportedAgent(args.agent);
  const graph = await args.graphRepository.load();
  const validation = validatePlanningGraph(graph);
  const workItem = graph.nodes.find((node): node is WorkItemNode => node.kind === "work_item" && node.id === args.workItemId);
  if (!workItem) {
    throw new Error(`Work Item not found: ${args.workItemId}`);
  }

  const readiness = validation.readinessSnapshots[workItem.id] ?? workItem.readinessSnapshot;
  const blockingLabels = readiness.labels.filter((label) => label === "blocked" || label === "hitl_gated" || label === "human_only");
  if (!readiness.labels.includes("agent_eligible") || blockingLabels.length > 0) {
    const reasons = readiness.reasons.length > 0 ? readiness.reasons.join("; ") : `readiness labels: ${readiness.labels.join(", ")}`;
    throw new Error(`Work Item is not agent-eligible for prepare: ${workItem.id}. ${reasons}`);
  }

  const context = await buildAgentContextSections({ graph, workItem, contextFileReader: args.contextFileReader });
  const validationCommands = validationCommandsForWorkItem(workItem, args.defaultValidationCommands);
  const content = renderAgentContextBundle({
    agent,
    mode: "prepare",
    graph,
    workItem,
    readiness,
    validationCommands,
    context
  });

  if (args.apply) {
    if (!args.runArtifactWriter) {
      throw new Error("theplanner prepare --apply requires an agent run artifact writer");
    }

    const generatedAt = args.timestamp ?? new Date().toISOString();
    const runId = createAgentRunId(generatedAt, workItem.id);
    const runDirectory = `planning/runs/${runId}`;
    const metadataPath = `${runDirectory}/metadata.json`;
    const promptPath = `${runDirectory}/prompt.md`;
    const contextPath = `${runDirectory}/context.md`;
    const metadata: AgentRunMetadata = {
      runId,
      workItemId: workItem.id,
      graphVersion: graph.graphVersion,
      agent,
      generatedAt,
      validationCommands
    };
    const files: readonly AgentRunArtifactFile[] = [
      { path: metadataPath, content: `${JSON.stringify(metadata, null, 2)}\n` },
      { path: promptPath, content },
      { path: contextPath, content: renderAgentContextMarkdown(context) }
    ];
    const writtenPaths = await args.runArtifactWriter.writeAll(files);
    const artifactPaths = writtenPaths ? [...writtenPaths] : files.map((file) => file.path);

    return {
      status: "prepared",
      dryRun: false,
      applied: true,
      agent,
      workItemId: workItem.id,
      runId,
      bundlePath: promptPath,
      artifactPaths,
      createdPaths: artifactPaths,
      metadata,
      readiness: {
        labels: readiness.labels,
        reasons: readiness.reasons
      },
      validationCommands,
      context,
      content,
      message: `Run artifacts written to ${runDirectory}. No agent was executed.`
    };
  }

  return {
    status: "prepared",
    dryRun: true,
    applied: false,
    agent,
    workItemId: workItem.id,
    runId: null,
    bundlePath: null,
    artifactPaths: [],
    createdPaths: [],
    metadata: null,
    readiness: {
      labels: readiness.labels,
      reasons: readiness.reasons
    },
    validationCommands,
    context,
    content,
    message: "Dry run only. No agent was executed and no run artifacts were written."
  };
}

export async function runAgentUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly contextFileReader: ContextFileReader;
  readonly runArtifactWriter: AgentRunArtifactWriter;
  readonly agentRunner: AgentRunner;
  readonly validationCommandRunner: ValidationCommandRunner;
  readonly workItemId: string;
  readonly agent: string;
  readonly defaultValidationCommands?: readonly string[];
  readonly timestamp?: string;
}): Promise<AgentExecutionResult> {
  const agent = parseRunnableAgent(args.agent);
  const graph = await args.graphRepository.load();
  const validation = validatePlanningGraph(graph);
  const workItem = graph.nodes.find((node): node is WorkItemNode => node.kind === "work_item" && node.id === args.workItemId);
  if (!workItem) {
    throw new Error(`Work Item not found: ${args.workItemId}`);
  }

  const readiness = validation.readinessSnapshots[workItem.id] ?? workItem.readinessSnapshot;
  const blockingLabels = readiness.labels.filter((label) => label === "blocked" || label === "hitl_gated" || label === "human_only");
  if (!readiness.labels.includes("agent_eligible") || !readiness.labels.includes("afk_ready") || blockingLabels.length > 0) {
    const reasons = readiness.reasons.length > 0 ? readiness.reasons.join("; ") : `readiness labels: ${readiness.labels.join(", ")}`;
    throw new Error(`Work Item is not ready for agent run: ${workItem.id}. ${reasons}`);
  }

  const context = await buildAgentContextSections({ graph, workItem, contextFileReader: args.contextFileReader });
  const validationCommands = validationCommandsForWorkItem(workItem, args.defaultValidationCommands);
  const prompt = renderAgentContextBundle({
    agent,
    mode: "run",
    graph,
    workItem,
    readiness,
    validationCommands,
    context
  });

  const generatedAt = args.timestamp ?? new Date().toISOString();
  const runId = createAgentRunId(generatedAt, workItem.id);
  const runDirectory = `planning/runs/${runId}`;
  const metadataPath = `${runDirectory}/metadata.json`;
  const promptPath = `${runDirectory}/prompt.md`;
  const contextPath = `${runDirectory}/context.md`;
  const stdoutPath = `${runDirectory}/runner-stdout.log`;
  const stderrPath = `${runDirectory}/runner-stderr.log`;
  const resultPath = `${runDirectory}/result.json`;
  const validationStdoutPath = `${runDirectory}/validation-stdout.log`;
  const validationStderrPath = `${runDirectory}/validation-stderr.log`;
  const executableValidationCommands = workItem.validationMethods
    .map((method) => method.command)
    .filter((command): command is string => Boolean(command));
  const commandsToRun = executableValidationCommands.length > 0 ? executableValidationCommands : (args.defaultValidationCommands ?? []);
  const emptyValidation: AgentRunValidationSummary = { status: "pass", commands: [] };
  const metadata: AgentExecutionRunMetadata = {
    runId,
    workItemId: workItem.id,
    graphVersion: graph.graphVersion,
    agent,
    generatedAt,
    validationCommands,
    validation: emptyValidation
  };

  const runnerResult = await args.agentRunner.run({
    agent,
    workItemId: workItem.id,
    runId,
    prompt,
    runDirectory
  });

  const validationResults: ValidationCommandResult[] = [];
  for (const command of commandsToRun) {
    validationResults.push(
      await args.validationCommandRunner.run({
        command,
        workItemId: workItem.id,
        runId,
        runDirectory
      })
    );
  }
  const validationSummary: AgentRunValidationSummary = {
    status: validationResults.every((result) => result.exitCode === 0 && !result.error) ? "pass" : "fail",
    commands: validationResults.map((result) => ({
      command: result.command,
      exitCode: result.exitCode,
      ...(result.output ? { output: result.output } : {}),
      ...(result.error ? { error: result.error } : {})
    }))
  };
  const metadataWithValidation: AgentExecutionRunMetadata = {
    ...metadata,
    validation: validationSummary
  };
  const status =
    runnerResult.exitCode === 0 && !runnerResult.error && validationSummary.status === "pass" ? "completed" : "failed";
  const result: AgentExecutionResult = {
    status,
    agent,
    workItemId: workItem.id,
    runId,
    runDirectory,
    bundlePath: promptPath,
    artifactPaths: [
      metadataPath,
      promptPath,
      contextPath,
      stdoutPath,
      stderrPath,
      validationStdoutPath,
      validationStderrPath,
      resultPath
    ],
    createdPaths: [
      metadataPath,
      promptPath,
      contextPath,
      stdoutPath,
      stderrPath,
      validationStdoutPath,
      validationStderrPath,
      resultPath
    ],
    metadata: metadataWithValidation,
    readiness: {
      labels: readiness.labels,
      reasons: readiness.reasons
    },
    validationCommands,
    validation: validationSummary,
    runner: {
      command: runnerResult.command,
      exitCode: runnerResult.exitCode,
      ...(runnerResult.output ? { output: runnerResult.output } : {}),
      ...(runnerResult.error ? { error: runnerResult.error } : {})
    },
    message:
      status === "completed"
        ? `Agent run completed, validation passed, and artifacts were written to ${runDirectory}.`
        : `Agent run failed or validation did not pass; artifacts were written to ${runDirectory}.`
  };

  const files: readonly AgentRunArtifactFile[] = [
    { path: metadataPath, content: `${JSON.stringify(metadataWithValidation, null, 2)}\n` },
    { path: promptPath, content: prompt },
    { path: contextPath, content: renderAgentContextMarkdown(context) },
    { path: stdoutPath, content: runnerResult.stdout },
    { path: stderrPath, content: runnerResult.stderr },
    { path: validationStdoutPath, content: validationResults.map((result) => result.stdout).join("") },
    { path: validationStderrPath, content: validationResults.map((result) => result.stderr).join("") },
    { path: resultPath, content: `${JSON.stringify(result, null, 2)}\n` }
  ];
  const writtenPaths = await args.runArtifactWriter.writeAll(files);

  return {
    ...result,
    artifactPaths: writtenPaths ? [...writtenPaths] : result.artifactPaths,
    createdPaths: writtenPaths ? [...writtenPaths] : result.createdPaths
  };
}

export async function reviewAgentRunUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly runArtifactReader: AgentRunArtifactReader;
  readonly runId: string;
}): Promise<AgentRunReviewResult> {
  const summary = await loadAgentRunSummary(args.runArtifactReader, args.runId);
  const graph = await args.graphRepository.load();
  const workItem = graph.nodes.find(
    (node): node is WorkItemNode => node.kind === "work_item" && node.id === summary.metadata.workItemId
  );

  return {
    status: "ready_for_review",
    runId: summary.metadata.runId,
    runDirectory: summary.runDirectory,
    workItem: {
      id: summary.metadata.workItemId,
      ...(workItem ? { title: workItem.title } : {})
    },
    agent: summary.metadata.agent,
    graphVersion: summary.metadata.graphVersion,
    generatedAt: summary.metadata.generatedAt,
    changedFiles: summary.changedFiles,
    runner: summary.runner,
    validation: summary.metadata.validation,
    artifacts: summary.artifacts,
    message: `Review run ${summary.metadata.runId} before accepting or rejecting its planning impact.`
  };
}

export async function proposeAgentRunReviewGraphOperationsUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly runArtifactReader: AgentRunArtifactReader;
  readonly proposer: ReviewerGraphOperationProposer;
  readonly runId: string;
}): Promise<AgentRunReviewerProposalResult> {
  const summary = await loadAgentRunSummary(args.runArtifactReader, args.runId);
  const graph = await args.graphRepository.load();
  const workItem = graph.nodes.find(
    (node): node is WorkItemNode => node.kind === "work_item" && node.id === summary.metadata.workItemId
  );
  if (!workItem) {
    throw new Error(`Work Item not found for run ${summary.metadata.runId}: ${summary.metadata.workItemId}`);
  }

  const runStatus = isPassingAgentRunSummary(summary) ? "passed" : "failed";
  const graphContext = selectExecutionSliceContext(graph, workItem);
  const proposerResult = await args.proposer.propose({
    graphContext: deepCloneApplicationValue(graphContext),
    run: {
      runId: summary.metadata.runId,
      runDirectory: summary.runDirectory,
      workItemId: summary.metadata.workItemId,
      agent: summary.metadata.agent,
      graphVersion: summary.metadata.graphVersion,
      generatedAt: summary.metadata.generatedAt,
      validation: deepCloneApplicationValue(summary.metadata.validation),
      runner: deepCloneApplicationValue(summary.runner),
      changedFiles: deepCloneApplicationValue(summary.changedFiles),
      artifacts: deepCloneApplicationValue(summary.artifacts)
    }
  });

  const results: GraphOperationDryRunResult[] = [];
  const proposedOperations: GraphOperationProposalSummary[] = [];
  let candidateGraph = deepCloneApplicationValue(graph);

  for (const [index, proposal] of proposerResult.proposals.entries()) {
    const sourcePath = proposal.sourceReference ?? `${summary.runDirectory}/result.json#reviewer-proposal-${index + 1}`;
    let parsedOperation: ProposedGraphOperation;
    try {
      parsedOperation = parseProposedGraphOperationJson(proposal.operation);
    } catch (error) {
      const result = rejectedGraphOperationParseResult({
        graph: candidateGraph,
        sourcePath,
        error
      });
      results.push(result);
      return rejectedAgentRunReviewerProposalResult({
        graph,
        candidateGraph,
        summary,
        workItem,
        runStatus,
        proposalCount: proposerResult.proposals.length,
        proposedOperations,
        results,
        message: "At least one reviewer Graph Operation proposal was rejected. No planning files were written."
      });
    }

    if (runStatus === "failed" && !isFailureBlockerReviewerOperation(parsedOperation)) {
      const result = rejectedReviewerPolicyResult({
        graph: candidateGraph,
        sourcePath,
        operation: parsedOperation,
        message: "Failed agent runs must surface as a proposed HITL Gate, blocking Open Question, or blocked follow-up Work Item."
      });
      results.push(result);
      proposedOperations.push(summarizeProposedOperation(sourcePath, parsedOperation, result));
      return rejectedAgentRunReviewerProposalResult({
        graph,
        candidateGraph,
        summary,
        workItem,
        runStatus,
        proposalCount: proposerResult.proposals.length,
        proposedOperations,
        results,
        message: "Reviewer proposal did not surface the failed run as a blocker/HITL path. No planning files were written."
      });
    }

    const result = dryRunGraphOperationCandidate({
      graph: candidateGraph,
      operation: parsedOperation,
      sourcePath
    });
    results.push(result);
    proposedOperations.push(summarizeProposedOperation(sourcePath, parsedOperation, result));

    if (result.status === "rejected") {
      return rejectedAgentRunReviewerProposalResult({
        graph,
        candidateGraph,
        summary,
        workItem,
        runStatus,
        proposalCount: proposerResult.proposals.length,
        proposedOperations,
        results,
        message: "At least one reviewer Graph Operation proposal was rejected. No planning files were written."
      });
    }

    candidateGraph = parsePlanningGraphJson(result.candidateGraph);
  }

  return {
    status: "candidate",
    dryRun: true,
    applied: false,
    runId: summary.metadata.runId,
    runDirectory: summary.runDirectory,
    workItem: {
      id: workItem.id,
      title: workItem.title
    },
    runStatus,
    proposalCount: proposerResult.proposals.length,
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: candidateGraph.graphVersion,
    proposedOperations,
    results,
    candidateGraph: serializePlanningGraphJson(candidateGraph),
    validation: validatePlanningGraph(candidateGraph),
    message: "Dry run only. Reviewer proposals were applied to a validated candidate graph; no planning files were written."
  };
}

export async function decideAgentRunUseCase(args: {
  readonly graphRepository: GraphRepository;
  readonly runArtifactReader: AgentRunArtifactReader;
  readonly changeLogWriter: ChangeLogWriter;
  readonly runId: string;
  readonly decision: "accepted" | "rejected";
  readonly timestamp?: string;
}): Promise<AgentRunDecisionResult> {
  const summary = await loadAgentRunSummary(args.runArtifactReader, args.runId);
  const graph = await args.graphRepository.load();
  const timestamp = args.timestamp ?? new Date().toISOString();
  const event = createChangeLogEvent({
    graphVersionBefore: graph.graphVersion,
    graphVersionAfter: graph.graphVersion,
    affectedNodeIds: [summary.metadata.workItemId],
    actor: "human",
    timestamp,
    operationType: args.decision === "accepted" ? "agent_run_accepted" : "agent_run_rejected",
    approvalStatus: args.decision,
    summary:
      args.decision === "accepted"
        ? `Accepted agent run ${summary.metadata.runId} for Work Item ${summary.metadata.workItemId}.`
        : `Rejected agent run ${summary.metadata.runId} for Work Item ${summary.metadata.workItemId}.`,
    provenanceReference: `${summary.runDirectory}/result.json`
  });
  await args.changeLogWriter.append(event);

  return {
    status: args.decision,
    runId: summary.metadata.runId,
    workItemId: summary.metadata.workItemId,
    event,
    message:
      args.decision === "accepted"
        ? `Accepted run ${summary.metadata.runId}. No Work Item state was changed automatically.`
        : `Rejected run ${summary.metadata.runId}. No Work Item state was changed automatically.`
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

interface LoadedAgentRunSummary {
  readonly runDirectory: string;
  readonly metadata: AgentExecutionRunMetadata;
  readonly runner: AgentExecutionResult["runner"];
  readonly changedFiles: readonly string[];
  readonly artifacts: readonly string[];
}

interface ParsedAgentExecutionResult extends Pick<AgentExecutionResult, "runId" | "runner" | "artifactPaths"> {
  readonly changedFiles: readonly string[];
}

async function loadAgentRunSummary(
  runArtifactReader: AgentRunArtifactReader,
  runId: string
): Promise<LoadedAgentRunSummary> {
  if (!/^run-[0-9]{8}-[0-9]{6}-wi-[0-9]{3}$/u.test(runId)) {
    throw new Error(`Invalid run id: ${runId}`);
  }

  const runDirectory = `planning/runs/${runId}`;
  const metadata = parseAgentExecutionRunMetadata(
    await readRunArtifact(runArtifactReader, `${runDirectory}/metadata.json`, runId)
  );
  const result = parseAgentExecutionResult(await readRunArtifact(runArtifactReader, `${runDirectory}/result.json`, runId));

  if (metadata.runId !== runId || result.runId !== runId) {
    throw new Error(`Run artifact id mismatch for: ${runId}`);
  }

  return {
    runDirectory,
    metadata,
    runner: result.runner,
    changedFiles: result.changedFiles,
    artifacts: result.artifactPaths
  };
}

function isPassingAgentRunSummary(summary: LoadedAgentRunSummary): boolean {
  return summary.runner.exitCode === 0 && !summary.runner.error && summary.metadata.validation.status === "pass";
}

function isFailureBlockerReviewerOperation(operation: ProposedGraphOperation): boolean {
  if (operation.kind === "AddHitlGate") {
    return operation.hitlGate.status !== "resolved" && operation.hitlGate.blocks.length > 0;
  }

  if (operation.kind === "AddOpenQuestion") {
    return operation.openQuestion.blocksExecution;
  }

  return operation.kind === "AddWorkItem";
}

async function readRunArtifact(runArtifactReader: AgentRunArtifactReader, path: string, runId: string): Promise<string> {
  try {
    return await runArtifactReader.read(path);
  } catch (error) {
    throw new Error(`Run artifacts not found for ${runId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseAgentExecutionRunMetadata(content: string): AgentExecutionRunMetadata {
  const value = parseJsonObject(content, "run metadata");
  const validation = readValidationSummary(value.validation);
  const agent = value.agent;
  if (agent !== "codex" && agent !== "claude" && agent !== "gemini") {
    throw new Error("Run metadata is not a runnable agent metadata artifact.");
  }

  return {
    runId: readString(value.runId, "metadata.runId"),
    workItemId: readString(value.workItemId, "metadata.workItemId"),
    graphVersion: readInteger(value.graphVersion, "metadata.graphVersion"),
    agent,
    generatedAt: readString(value.generatedAt, "metadata.generatedAt"),
    validationCommands: readStringArray(value.validationCommands, "metadata.validationCommands"),
    validation
  };
}

function parseAgentExecutionResult(content: string): ParsedAgentExecutionResult {
  const value = parseJsonObject(content, "run result");
  const runner = parseJsonObjectProperty(value.runner, "result.runner");

  return {
    runId: readString(value.runId, "result.runId"),
    runner: {
      command: readStringArray(runner.command, "result.runner.command"),
      exitCode: readInteger(runner.exitCode, "result.runner.exitCode"),
      ...(runner.output ? { output: readOutputSummary(runner.output, "result.runner.output") } : {}),
      ...(runner.error ? { error: readRunnerError(runner.error) } : {})
    },
    artifactPaths: readStringArray(value.artifactPaths, "result.artifactPaths"),
    changedFiles: readStringArrayProperty(value, "changedFiles") ?? readStringArrayProperty(value, "changed_files") ?? []
  };
}

function parseJsonObject(content: string, artifactName: string): Record<string, unknown> {
  try {
    return parseJsonObjectProperty(JSON.parse(content), artifactName);
  } catch (error) {
    throw new Error(`Invalid ${artifactName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function deepCloneApplicationValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function parseJsonObjectProperty(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function parseGraphOperationProposal(value: unknown): ParsedGraphOperationProposal {
  return parseProposedGraphOperationProposalJson(value);
}

function parseGraphOperationUserAnswers(value: unknown, sourcePath: string): readonly GraphOperationUserAnswerInput[] {
  const rawAnswers = Array.isArray(value)
    ? value
    : readArray(parseJsonObjectProperty(value, "Graph Operation user answers").answers, "answers");

  return rawAnswers.map((rawAnswer, index) => {
    const answer = parseJsonObjectProperty(rawAnswer, `answers[${index}]`);
    const questionId = readOptionalString(answer.question_id ?? answer.questionId, `answers[${index}].question_id`);
    const question = readOptionalString(answer.question, `answers[${index}].question`);
    const sourceReference =
      readOptionalString(answer.source_reference ?? answer.sourceReference, `answers[${index}].source_reference`) ??
      `${sourcePath}#answer-${index + 1}`;

    return {
      ...(questionId ? { questionId } : {}),
      ...(question ? { question } : {}),
      answer: readString(answer.answer, `answers[${index}].answer`),
      sourceReference
    };
  });
}

function affectedNodeIdsForGraphOperation(operation: ProposedGraphOperation): readonly string[] {
  if (operation.kind === "AddOpenQuestion") {
    return [operation.openQuestion.id];
  }

  if (operation.kind === "AddRequirement") {
    return [operation.requirement.id];
  }

  if (operation.kind === "AddDecision") {
    return [operation.decision.id];
  }

  if (operation.kind === "AddWorkItem") {
    return uniqueStrings([operation.workItem.id, ...operation.edges.flatMap((edge) => [edge.source, edge.target])]);
  }

  if (operation.kind === "AddDependencyEdge") {
    return uniqueStrings([operation.edge.source, operation.edge.target]);
  }

  if (operation.kind === "AddHitlGate") {
    return uniqueStrings([operation.hitlGate.id, ...operation.hitlGate.blocks, ...operation.edges.flatMap((edge) => [edge.source, edge.target])]);
  }

  if (operation.kind === "UpdateWorkItemExecutionState") {
    return [operation.workItemId];
  }

  return [];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function readValidationSummary(value: unknown): AgentRunValidationSummary {
  const summary = parseJsonObjectProperty(value, "metadata.validation");
  const status = summary.status;
  if (status !== "pass" && status !== "fail") {
    throw new Error("metadata.validation.status must be pass or fail.");
  }

  const commands = readArray(summary.commands, "metadata.validation.commands").map((command, index) => {
    const commandObject = parseJsonObjectProperty(command, `metadata.validation.commands[${index}]`);
    return {
      command: readString(commandObject.command, `metadata.validation.commands[${index}].command`),
      exitCode: readInteger(commandObject.exitCode, `metadata.validation.commands[${index}].exitCode`),
      ...(commandObject.output
        ? { output: readOutputSummary(commandObject.output, `metadata.validation.commands[${index}].output`) }
        : {}),
      ...(commandObject.error ? { error: readRunnerError(commandObject.error) } : {})
    };
  });

  return { status, commands };
}

function readRunnerError(value: unknown): AgentRunnerError {
  const error = parseJsonObjectProperty(value, "runner.error");
  return {
    code: readString(error.code, "runner.error.code"),
    message: readString(error.message, "runner.error.message")
  };
}

function readOutputSummary(value: unknown, path: string): ProcessOutputSummary {
  const output = parseJsonObjectProperty(value, path);
  return {
    stdoutBytes: readInteger(output.stdoutBytes, `${path}.stdoutBytes`),
    stderrBytes: readInteger(output.stderrBytes, `${path}.stderrBytes`),
    stdoutTruncated: readBoolean(output.stdoutTruncated, `${path}.stdoutTruncated`),
    stderrTruncated: readBoolean(output.stderrTruncated, `${path}.stderrTruncated`),
    outputLimitBytes: readInteger(output.outputLimitBytes, `${path}.outputLimitBytes`)
  };
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, path);
}

function readInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer.`);
  }

  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean.`);
  }

  return value;
}

function readArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value;
}

function readStringArray(value: unknown, path: string): readonly string[] {
  const values = readArray(value, path);
  if (!values.every((entry) => typeof entry === "string")) {
    throw new Error(`${path} must contain only strings.`);
  }

  return values;
}

function readStringArrayProperty(value: unknown, key: string): readonly string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || !(key in value)) {
    return undefined;
  }

  return readStringArray((value as Record<string, unknown>)[key], key);
}

function isEmptyPlanningGraph(graph: PlanningGraph): boolean {
  return graph.nodes.length === 0 && graph.edges.length === 0;
}

function graphVersionFromJson(value: unknown): number {
  if (value && typeof value === "object" && !Array.isArray(value) && "graph_version" in value) {
    const rawVersion = value.graph_version;
    return typeof rawVersion === "number" && Number.isInteger(rawVersion) ? rawVersion : 0;
  }

  return 0;
}

function createAgentRunId(timestamp: string, workItemId: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid prepare timestamp: ${timestamp}`);
  }

  const compactTimestamp = date.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "").replace("T", "-");
  return `run-${compactTimestamp}-${workItemId}`;
}

function parseSupportedAgent(agent: string): SupportedAgent {
  if (agent === "codex" || agent === "claude" || agent === "gemini") {
    return agent;
  }

  throw new Error(`Unsupported agent: ${agent}. Supported agents: codex, claude, gemini.`);
}

function parseRunnableAgent(agent: string): RunnableAgent {
  if (agent === "codex" || agent === "claude" || agent === "gemini") {
    return agent;
  }

  throw new Error(`Unsupported run agent: ${agent}. Supported run agents: codex, claude, gemini.`);
}

type JsonLoadFailure = {
  readonly failed: true;
  readonly message: string;
};

async function loadGraphJsonForSchemaValidation(graphRepository: GraphRepository): Promise<unknown | JsonLoadFailure> {
  try {
    return await graphRepository.loadJson?.();
  } catch (error) {
    return {
      failed: true,
      message: `planning/graph.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function validateGraphJsonSchema(
  schemaValidator: JsonSchemaValidator | undefined,
  rawGraph: unknown
): Promise<SchemaValidationReport | undefined> {
  try {
    return await schemaValidator?.validate(rawGraph);
  } catch (error) {
    return {
      status: "error",
      errors: [
        {
          code: "schema_validation_unavailable",
          message: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
}

function isJsonLoadFailure(value: unknown): value is JsonLoadFailure {
  return Boolean(value && typeof value === "object" && "failed" in value && value.failed === true);
}

function emptyReadinessSummary(): GraphValidationResult["readinessSummary"] {
  return {
    afkReady: [],
    agentEligible: [],
    blocked: [],
    hitlGated: [],
    humanOnly: []
  };
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
    path: "planning/graph.schema.json",
    content: graphSchemaTemplate
  },
  {
    path: "planning/graph.json",
    content: `${JSON.stringify(
      {
        schema_version: currentPlanningGraphSchemaVersion,
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
