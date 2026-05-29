import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { defaultPlannerConfig, parsePlannerConfig } from "../../application/index.js";
import type { PlannerConfig } from "../../application/index.js";

export async function loadFilePlannerConfig(path = "planner.config.json"): Promise<PlannerConfig> {
  try {
    const content = await readFile(resolve(path), "utf8");
    return parsePlannerConfig(JSON.parse(content), path);
  } catch (error) {
    if (isNotFound(error)) {
      return defaultPlannerConfig;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`${path} is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

export function createPlanningPathMapper(planningDirectory: string): (path: string) => string {
  return (path: string) => {
    if (planningDirectory === "planning") {
      return path;
    }

    if (path === "planning") {
      return planningDirectory;
    }

    if (path.startsWith("planning/")) {
      return `${planningDirectory}${path.slice("planning".length)}`;
    }

    return path;
  };
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
