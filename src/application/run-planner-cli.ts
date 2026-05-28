export interface PlannerCliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

import {
  exportProjectionsUseCase,
  reconcileGraphUseCase,
  statusUseCase,
  validateGraphUseCase
} from "./planner-use-cases.js";
import type {
  ChangeLogWriter,
  GraphRepository,
  ProjectionReader,
  ProjectionWriter
} from "./planner-use-cases.js";

export interface PlannerCliServices {
  readonly graphRepository: GraphRepository;
  readonly projectionWriter: ProjectionWriter;
  readonly projectionReader?: ProjectionReader;
  readonly changeLogWriter?: ChangeLogWriter;
}

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

  if (command === "plan") {
    if (!rest.includes("--brief")) {
      return { exitCode: 1, stdout: "", stderr: "planner plan requires --brief <file>\n" };
    }

    return render(0, { status: "scaffolded", command: "plan" }, json);
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

  return {
    exitCode,
    stdout: `${JSON.stringify(value)}\n`,
    stderr: ""
  };
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
