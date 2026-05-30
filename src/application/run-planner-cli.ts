export interface PlannerCliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

import {
  exportProjectionsUseCase,
  initWorkspaceUseCase,
  intakeQuestionsUseCase,
  decideAgentRunUseCase,
  planFromBriefApplyUseCase,
  planFromBriefDryRunUseCase,
  prepareAgentContextBundleUseCase,
  refineIntakeBriefUseCase,
  reconcileGraphUseCase,
  reviewAgentRunUseCase,
  runAgentUseCase,
  statusUseCase,
  syncTrackerDryRunUseCase,
  validateGraphUseCase
} from "./planner-use-cases.js";
import type {
  AgentRunner,
  AgentRunArtifactReader,
  AgentRunArtifactWriter,
  ChangeLogWriter,
  ContextFileReader,
  GraphRepository,
  IntakeIdeaReader,
  JsonSchemaValidator,
  ProjectionReader,
  ProjectionWriter,
  RefinedBriefReader,
  RefinedBriefWriter,
  SupportedTracker,
  TrackerSyncAdapter,
  ValidationCommandRunner,
  SupportedAgent,
  WorkspaceInitializer
} from "./planner-use-cases.js";

export interface PlannerCliServices {
  readonly graphRepository: GraphRepository;
  readonly graphSchemaValidator?: JsonSchemaValidator;
  readonly projectionWriter: ProjectionWriter;
  readonly projectionReader?: ProjectionReader;
  readonly changeLogWriter?: ChangeLogWriter;
  readonly workspaceInitializer?: WorkspaceInitializer;
  readonly intakeIdeaReader?: IntakeIdeaReader;
  readonly refinedBriefReader?: RefinedBriefReader;
  readonly refinedBriefWriter?: RefinedBriefWriter;
  readonly contextFileReader?: ContextFileReader;
  readonly runArtifactReader?: AgentRunArtifactReader;
  readonly runArtifactWriter?: AgentRunArtifactWriter;
  readonly agentRunner?: AgentRunner;
  readonly validationCommandRunner?: ValidationCommandRunner;
  readonly trackerSyncAdapters?: readonly TrackerSyncAdapter[];
  readonly defaultAgent?: SupportedAgent;
  readonly defaultValidationCommands?: readonly string[];
  readonly currentTimestamp?: () => string;
}

type RenderableIntakeQuestionResult = {
  readonly sourcePath: string;
  readonly ideaPreview: string;
  readonly agentPrompt: string;
  readonly groups: readonly {
    readonly title: string;
    readonly questions: readonly {
      readonly id: string;
      readonly question: string;
    }[];
  }[];
};

export async function runPlannerCli(
  args: readonly string[],
  services: PlannerCliServices
): Promise<PlannerCliResult> {
  const [command, ...rest] = args;
  const json = args.includes("--json");

  if (command === "validate") {
    const result = await validateGraphUseCase({
      graphRepository: services.graphRepository,
      schemaValidator: services.graphSchemaValidator
    });
    return render(result.exitCode, result.validation, json);
  }

  if (command === "status") {
    const result = await statusUseCase(services.graphRepository);
    return render(0, result, json);
  }

  if (command === "export") {
    const dryRun = rest.includes("--dry-run");
    const apply = rest.includes("--apply");
    if (dryRun && apply) {
      return fail("theplanner export accepts only one of --dry-run or --apply", json);
    }
    if (dryRun && !services.projectionReader) {
      return fail("theplanner export --dry-run requires a projection reader", json);
    }

    try {
      const result = await exportProjectionsUseCase({
        graphRepository: services.graphRepository,
        projectionWriter: services.projectionWriter,
        projectionReader: services.projectionReader,
        apply: !dryRun
      });
      return render(0, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command === "init") {
    if (!services.workspaceInitializer) {
      return fail("theplanner init requires a workspace initializer", json);
    }

    const result = await initWorkspaceUseCase(services.workspaceInitializer);
    return render(0, result, json);
  }

  if (command === "intake") {
    if (rest[0] === "questions") {
      if (!services.intakeIdeaReader) {
        return fail("theplanner intake questions requires an intake idea reader", json);
      }

      const from = readOption(rest, "--from");
      if (!from) {
        return fail("theplanner intake questions requires --from <file>", json);
      }

      try {
        const result = await intakeQuestionsUseCase({ intakeIdeaReader: services.intakeIdeaReader, path: from });
        return render(0, result, json);
      } catch (error) {
        return renderError(error, json);
      }
    }

    if (rest[0] === "refine") {
      if (!services.intakeIdeaReader) {
        return fail("theplanner intake refine requires an intake idea reader", json);
      }

      if (!services.refinedBriefWriter) {
        return fail("theplanner intake refine requires a refined brief writer", json);
      }

      const from = readOption(rest, "--from");
      if (!from) {
        return fail("theplanner intake refine requires --from <file>", json);
      }

      const out = readOption(rest, "--out");
      if (!out) {
        return fail("theplanner intake refine requires --out <file>", json);
      }

      try {
        const result = await refineIntakeBriefUseCase({
          intakeIdeaReader: services.intakeIdeaReader,
          refinedBriefWriter: services.refinedBriefWriter,
          fromPath: from,
          outPath: out,
          force: rest.includes("--force")
        });
        return render(0, result, json);
      } catch (error) {
        return renderError(error, json);
      }
    }

    return fail("theplanner intake requires the questions or refine subcommand", json);
  }

  if (command === "plan") {
    if (!services.refinedBriefReader) {
      return fail("theplanner plan requires a refined brief reader", json);
    }

    const from = readOption(rest, "--from");
    if (!from) {
      return fail("theplanner plan requires --from <file>", json);
    }

    const dryRun = rest.includes("--dry-run");
    const apply = rest.includes("--apply");
    if (dryRun === apply) {
      return fail("theplanner plan requires exactly one of --dry-run or --apply", json);
    }

    try {
      const result = apply
        ? await planFromBriefApplyUseCase({
            graphRepository: services.graphRepository,
            refinedBriefReader: services.refinedBriefReader,
            changeLogWriter: requireChangeLogWriter(services.changeLogWriter),
            fromPath: from
          })
        : await planFromBriefDryRunUseCase({
            refinedBriefReader: services.refinedBriefReader,
            fromPath: from
          });
      return render(result.validation.status === "error" ? 1 : 0, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command === "reconcile") {
    if (!services.projectionReader) {
      return fail("theplanner reconcile requires a projection reader", json);
    }

    try {
      const result = await reconcileGraphUseCase({
        graphRepository: services.graphRepository,
        projectionReader: services.projectionReader,
        changeLogWriter: services.changeLogWriter,
        apply: rest.includes("--apply")
      });
      return render(0, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command === "sync") {
    const tracker = rest[0];
    if (!tracker || tracker.startsWith("--")) {
      return fail("theplanner sync requires <tracker>", json);
    }

    if (!isSupportedTracker(tracker)) {
      return fail(`Unsupported tracker: ${tracker}`, json);
    }

    if (rest.includes("--apply")) {
      return fail("theplanner sync --apply is deferred; use --dry-run to preview tracker payloads", json);
    }

    if (!rest.includes("--dry-run")) {
      return fail("theplanner sync requires --dry-run; live sync is deferred", json);
    }

    const trackerAdapter = services.trackerSyncAdapters?.find((adapter) => adapter.tracker === tracker);
    if (!trackerAdapter) {
      return fail(`theplanner sync ${tracker} requires a tracker sync adapter`, json);
    }

    try {
      const result = await syncTrackerDryRunUseCase({
        graphRepository: services.graphRepository,
        trackerAdapter
      });
      return render(0, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command === "prepare") {
    if (!services.contextFileReader) {
      return fail("theplanner prepare requires a context file reader", json);
    }

    const workItemId = rest[0];
    if (!workItemId || workItemId.startsWith("--")) {
      return fail("theplanner prepare requires <work-item-id>", json);
    }

    const agent = readOption(rest, "--agent") ?? services.defaultAgent;
    if (!agent) {
      return fail("theplanner prepare requires --agent <codex|claude|gemini>", json);
    }

    const dryRun = rest.includes("--dry-run");
    const apply = rest.includes("--apply");
    if (dryRun === apply) {
      return fail("theplanner prepare requires exactly one of --dry-run or --apply", json);
    }

    if (apply && !services.runArtifactWriter) {
      return fail("theplanner prepare --apply requires an agent run artifact writer", json);
    }

    try {
      const result = await prepareAgentContextBundleUseCase({
        graphRepository: services.graphRepository,
        contextFileReader: services.contextFileReader,
        runArtifactWriter: services.runArtifactWriter,
        workItemId,
        agent,
        defaultValidationCommands: services.defaultValidationCommands,
        apply,
        timestamp: services.currentTimestamp?.()
      });
      return render(0, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command === "run") {
    if (rest[0] === "review" || rest[0] === "accept" || rest[0] === "reject") {
      if (!services.runArtifactReader) {
        return fail(`theplanner run ${rest[0]} requires an agent run artifact reader`, json);
      }

      const runId = rest[1];
      if (!runId || runId.startsWith("--")) {
        return fail(`theplanner run ${rest[0]} requires <run-id>`, json);
      }

      try {
        if (rest[0] === "review") {
          const result = await reviewAgentRunUseCase({
            graphRepository: services.graphRepository,
            runArtifactReader: services.runArtifactReader,
            runId
          });
          return render(0, result, json);
        }

        if (!services.changeLogWriter) {
          return fail(`theplanner run ${rest[0]} requires a planning change log writer`, json);
        }

        const result = await decideAgentRunUseCase({
          graphRepository: services.graphRepository,
          runArtifactReader: services.runArtifactReader,
          changeLogWriter: services.changeLogWriter,
          runId,
          decision: rest[0] === "accept" ? "accepted" : "rejected",
          timestamp: services.currentTimestamp?.()
        });
        return render(0, result, json);
      } catch (error) {
        return renderError(error, json);
      }
    }

    if (!services.contextFileReader) {
      return fail("theplanner run requires a context file reader", json);
    }

    if (!services.runArtifactWriter) {
      return fail("theplanner run requires an agent run artifact writer", json);
    }

    if (!services.agentRunner) {
      return fail("theplanner run requires an agent runner", json);
    }

    if (!services.validationCommandRunner) {
      return fail("theplanner run requires a validation command runner", json);
    }

    const workItemId = rest[0];
    if (!workItemId || workItemId.startsWith("--")) {
      return fail("theplanner run requires <work-item-id>", json);
    }

    const agent = readOption(rest, "--agent") ?? services.defaultAgent;
    if (!agent) {
      return fail("theplanner run requires --agent <codex|claude|gemini>", json);
    }

    try {
      const result = await runAgentUseCase({
        graphRepository: services.graphRepository,
        contextFileReader: services.contextFileReader,
        runArtifactWriter: services.runArtifactWriter,
        agentRunner: services.agentRunner,
        validationCommandRunner: services.validationCommandRunner,
        workItemId,
        agent,
        defaultValidationCommands: services.defaultValidationCommands,
        timestamp: services.currentTimestamp?.()
      });
      return render(result.status === "completed" ? 0 : 1, result, json);
    } catch (error) {
      return renderError(error, json);
    }
  }

  if (command) {
    return fail(`Unknown command: ${command}`, json);
  }

  return {
    exitCode: 0,
    stdout: "theplanner CLI scaffold\n",
    stderr: ""
  };
}

function fail(message: string, json: boolean): PlannerCliResult {
  return renderError(new Error(message), json);
}

function renderError(error: unknown, json: boolean): PlannerCliResult {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    return {
      exitCode: 1,
      stdout: `${JSON.stringify({ status: "failed", error: { message } }, null, 2)}\n`,
      stderr: ""
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `${message}\n`
  };
}

function requireChangeLogWriter(changeLogWriter: ChangeLogWriter | undefined): ChangeLogWriter {
  if (!changeLogWriter) {
    throw new Error("theplanner plan --apply requires a planning change log writer");
  }

  return changeLogWriter;
}

function render(exitCode: number, value: unknown, json: boolean): PlannerCliResult {
  if (json) {
    return {
      exitCode,
      stdout: `${JSON.stringify(value, null, 2)}\n`,
      stderr: ""
    };
  }

  if (isValidation(value)) {
    const readinessReasons = Object.entries(value.readinessSnapshots)
      .filter(([, snapshot]) => snapshot.reasons.length > 0)
      .flatMap(([id, snapshot]) => snapshot.reasons.map((reason) => `${id}: ${reason}`));
    return {
      exitCode,
      stdout: [
        `graph_version: ${value.graphVersion}`,
        `status: ${value.status}`,
        `schema_status: ${value.schemaStatus}`,
        `schema_errors: ${value.schemaErrors.length}`,
        `errors: ${value.semanticErrors.length}`,
        `warnings: ${value.semanticWarnings.length}`,
        "readiness_reasons:",
        ...(readinessReasons.length === 0 ? ["- None"] : readinessReasons.map((reason) => `- ${reason}`))
      ].join("\n") + "\n",
      stderr: ""
    };
  }

  if (isWorkspaceInitResult(value)) {
    return {
      exitCode,
      stdout: [
        "workspace initialized",
        ...value.entries.map((entry) => `${entry.status}: ${entry.path}`),
        ""
      ].join("\n"),
      stderr: ""
    };
  }

  if (isIntakeQuestionResult(value)) {
    return {
      exitCode,
      stdout: renderIntakeQuestions(value),
      stderr: ""
    };
  }

  if (isRefinedBriefResult(value)) {
    return {
      exitCode,
      stdout: [
        `refined_brief: ${value.status}`,
        `source: ${value.sourcePath}`,
        `out: ${value.outPath}`,
        value.message,
        ""
      ].join("\n"),
      stderr: ""
    };
  }

  if (isAgentContextBundleResult(value)) {
    return {
      exitCode,
      stdout: value.dryRun ? `${value.content}\n` : `${value.message}\n${value.artifactPaths.join("\n")}\n`,
      stderr: ""
    };
  }

  return {
    exitCode,
    stdout: `${JSON.stringify(value)}\n`,
    stderr: ""
  };
}

function readOption(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function isSupportedTracker(value: string): value is SupportedTracker {
  return value === "github";
}

function isWorkspaceInitResult(value: unknown): value is {
  readonly entries: readonly {
    readonly path: string;
    readonly status: string;
  }[];
} {
  return Boolean(value && typeof value === "object" && "entries" in value && Array.isArray(value.entries));
}

function isValidation(value: unknown): value is {
  readonly graphVersion: number;
  readonly status: string;
  readonly schemaStatus: string;
  readonly schemaErrors: readonly unknown[];
  readonly semanticErrors: readonly unknown[];
  readonly semanticWarnings: readonly unknown[];
  readonly readinessSnapshots: Readonly<Record<string, { readonly reasons: readonly string[] }>>;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "graphVersion" in value &&
      "schemaStatus" in value &&
      "schemaErrors" in value &&
      "semanticErrors" in value &&
      "semanticWarnings" in value
  );
}

function isIntakeQuestionResult(value: unknown): value is RenderableIntakeQuestionResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "sourcePath" in value &&
      "ideaPreview" in value &&
      "agentPrompt" in value &&
      "groups" in value &&
      Array.isArray(value.groups)
  );
}

function isRefinedBriefResult(value: unknown): value is {
  readonly status: string;
  readonly sourcePath: string;
  readonly outPath: string;
  readonly message: string;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "status" in value &&
      "sourcePath" in value &&
      "outPath" in value &&
      "message" in value
  );
}

function isAgentContextBundleResult(value: unknown): value is {
  readonly content: string;
  readonly dryRun: boolean;
  readonly artifactPaths: readonly string[];
  readonly message: string;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "content" in value &&
      typeof value.content === "string" &&
      "dryRun" in value &&
      typeof value.dryRun === "boolean" &&
      "artifactPaths" in value &&
      Array.isArray(value.artifactPaths) &&
      "message" in value &&
      typeof value.message === "string"
  );
}

function renderIntakeQuestions(value: RenderableIntakeQuestionResult): string {
  return [
    "# Intake Grilling Questions",
    "",
    `Source: ${value.sourcePath}`,
    "",
    "Idea preview:",
    `> ${value.ideaPreview || "(empty idea file)"}`,
    "",
    "How to use with an agent:",
    value.agentPrompt,
    "",
    ...value.groups.flatMap((group) => [
      `## ${group.title}`,
      "",
      ...group.questions.map((question) => `- ${question.question}`),
      ""
    ])
  ].join("\n");
}
