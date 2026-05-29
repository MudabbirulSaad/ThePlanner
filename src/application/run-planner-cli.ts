export interface PlannerCliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

import {
  exportProjectionsUseCase,
  initWorkspaceUseCase,
  intakeQuestionsUseCase,
  planFromBriefApplyUseCase,
  planFromBriefDryRunUseCase,
  refineIntakeBriefUseCase,
  reconcileGraphUseCase,
  statusUseCase,
  validateGraphUseCase
} from "./planner-use-cases.js";
import type {
  ChangeLogWriter,
  GraphRepository,
  IntakeIdeaReader,
  ProjectionReader,
  ProjectionWriter,
  RefinedBriefReader,
  RefinedBriefWriter,
  WorkspaceInitializer
} from "./planner-use-cases.js";

export interface PlannerCliServices {
  readonly graphRepository: GraphRepository;
  readonly projectionWriter: ProjectionWriter;
  readonly projectionReader?: ProjectionReader;
  readonly changeLogWriter?: ChangeLogWriter;
  readonly workspaceInitializer?: WorkspaceInitializer;
  readonly intakeIdeaReader?: IntakeIdeaReader;
  readonly refinedBriefReader?: RefinedBriefReader;
  readonly refinedBriefWriter?: RefinedBriefWriter;
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
  const json = rest.includes("--json");

  if (command === "validate") {
    const result = await validateGraphUseCase(services.graphRepository);
    return render(result.exitCode, result.validation, json);
  }

  if (command === "status") {
    const result = await statusUseCase(services.graphRepository);
    return render(0, result, json);
  }

  if (command === "export") {
    const result = await exportProjectionsUseCase(services.graphRepository, services.projectionWriter);
    return render(0, result, json);
  }

  if (command === "init") {
    if (!services.workspaceInitializer) {
      return { exitCode: 1, stdout: "", stderr: "planner init requires a workspace initializer\n" };
    }

    const result = await initWorkspaceUseCase(services.workspaceInitializer);
    return render(0, result, json);
  }

  if (command === "intake") {
    if (rest[0] === "questions") {
      if (!services.intakeIdeaReader) {
        return { exitCode: 1, stdout: "", stderr: "planner intake questions requires an intake idea reader\n" };
      }

      const from = readOption(rest, "--from");
      if (!from) {
        return { exitCode: 1, stdout: "", stderr: "planner intake questions requires --from <file>\n" };
      }

      try {
        const result = await intakeQuestionsUseCase({ intakeIdeaReader: services.intakeIdeaReader, path: from });
        return render(0, result, json);
      } catch (error) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `${error instanceof Error ? error.message : String(error)}\n`
        };
      }
    }

    if (rest[0] === "refine") {
      if (!services.intakeIdeaReader) {
        return { exitCode: 1, stdout: "", stderr: "planner intake refine requires an intake idea reader\n" };
      }

      if (!services.refinedBriefWriter) {
        return { exitCode: 1, stdout: "", stderr: "planner intake refine requires a refined brief writer\n" };
      }

      const from = readOption(rest, "--from");
      if (!from) {
        return { exitCode: 1, stdout: "", stderr: "planner intake refine requires --from <file>\n" };
      }

      const out = readOption(rest, "--out");
      if (!out) {
        return { exitCode: 1, stdout: "", stderr: "planner intake refine requires --out <file>\n" };
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
        return {
          exitCode: 1,
          stdout: "",
          stderr: `${error instanceof Error ? error.message : String(error)}\n`
        };
      }
    }

    return { exitCode: 1, stdout: "", stderr: "planner intake requires the questions or refine subcommand\n" };
  }

  if (command === "plan") {
    if (!services.refinedBriefReader) {
      return { exitCode: 1, stdout: "", stderr: "planner plan requires a refined brief reader\n" };
    }

    const from = readOption(rest, "--from");
    if (!from) {
      return { exitCode: 1, stdout: "", stderr: "planner plan requires --from <file>\n" };
    }

    const dryRun = rest.includes("--dry-run");
    const apply = rest.includes("--apply");
    if (dryRun === apply) {
      return { exitCode: 1, stdout: "", stderr: "planner plan requires exactly one of --dry-run or --apply\n" };
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
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`
      };
    }
  }

  if (command === "reconcile") {
    if (!services.projectionReader) {
      return { exitCode: 1, stdout: "", stderr: "planner reconcile requires a projection reader\n" };
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
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`
      };
    }
  }

  return {
    exitCode: command ? 1 : 0,
    stdout: command ? "" : "planner CLI scaffold\n",
    stderr: command ? `Unknown command: ${command}\n` : ""
  };
}

function requireChangeLogWriter(changeLogWriter: ChangeLogWriter | undefined): ChangeLogWriter {
  if (!changeLogWriter) {
    throw new Error("planner plan --apply requires a planning change log writer");
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
    return {
      exitCode,
      stdout: `graph_version: ${value.graphVersion}\nstatus: ${value.status}\nerrors: ${value.semanticErrors.length}\nwarnings: ${value.semanticWarnings.length}\n`,
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
  readonly semanticErrors: readonly unknown[];
  readonly semanticWarnings: readonly unknown[];
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "graphVersion" in value &&
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
