import {
  applyGraphPatches,
  reconcileGraphProjections,
  renderAllProjections,
  validatePlanningGraph,
  workItemProjectionPaths
} from "../core/index.js";
import type {
  GraphValidationResult,
  PlanningGraph,
  ProjectionInput,
  ReconciliationResult,
  RenderedProjection
} from "../core/index.js";

export interface GraphRepository {
  readonly load: () => Promise<PlanningGraph>;
  readonly save?: (graph: PlanningGraph) => Promise<void>;
}

export interface ProjectionWriter {
  readonly writeAll: (projections: readonly RenderedProjection[]) => Promise<void>;
}

export interface ProjectionReader {
  readonly readMany: (paths: readonly string[]) => Promise<readonly ProjectionInput[]>;
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

export async function exportProjectionsUseCase(
  graphRepository: GraphRepository,
  projectionWriter: ProjectionWriter
): Promise<{ readonly exported: readonly string[] }> {
  const graph = await graphRepository.load();
  const projections = renderAllProjections(graph);
  await projectionWriter.writeAll(projections);
  return { exported: projections.map((projection) => projection.path) };
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
