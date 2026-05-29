import type { SupportedAgent } from "./planner-use-cases.js";

export interface PlannerConfig {
  readonly planningDirectory: string;
  readonly defaultAgent: SupportedAgent;
  readonly agentCommands: Readonly<Record<SupportedAgent, string>>;
  readonly validationCommands: readonly string[];
}

export const defaultPlannerConfig: PlannerConfig = {
  planningDirectory: "planning",
  defaultAgent: "codex",
  agentCommands: {
    codex: "codex exec -",
    claude: "claude",
    gemini: "gemini"
  },
  validationCommands: []
};

export function parsePlannerConfig(value: unknown, sourcePath = "planner.config.json"): PlannerConfig {
  if (value === undefined) {
    return defaultPlannerConfig;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${sourcePath} must contain a JSON object.`);
  }

  const raw = value as Record<string, unknown>;
  const planningDirectory = readOptionalString(raw, "planningDirectory", sourcePath) ?? defaultPlannerConfig.planningDirectory;
  if (!isSafeRelativePath(planningDirectory)) {
    throw new Error(`${sourcePath}.planningDirectory must be a non-empty relative path without "." or ".." segments.`);
  }

  const defaultAgent = readOptionalAgent(raw, "defaultAgent", sourcePath) ?? defaultPlannerConfig.defaultAgent;
  const agentCommands = {
    ...defaultPlannerConfig.agentCommands,
    ...readAgentCommands(raw.agentCommands, sourcePath)
  };
  const validationCommands = readOptionalStringArray(raw, "validationCommands", sourcePath) ?? defaultPlannerConfig.validationCommands;

  return {
    planningDirectory,
    defaultAgent,
    agentCommands,
    validationCommands
  };
}

function readAgentCommands(value: unknown, sourcePath: string): Partial<Record<SupportedAgent, string>> {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${sourcePath}.agentCommands must be an object.`);
  }

  const raw = value as Record<string, unknown>;
  const commands: Partial<Record<SupportedAgent, string>> = {};
  for (const agent of ["codex", "claude", "gemini"] as const) {
    const command = readOptionalString(raw, agent, `${sourcePath}.agentCommands`);
    if (command !== undefined) {
      if (command.trim() === "") {
        throw new Error(`${sourcePath}.agentCommands.${agent} must not be empty.`);
      }
      commands[agent] = command;
    }
  }

  return commands;
}

function readOptionalAgent(raw: Record<string, unknown>, key: string, sourcePath: string): SupportedAgent | undefined {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }

  if (value === "codex" || value === "claude" || value === "gemini") {
    return value;
  }

  throw new Error(`${sourcePath}.${key} must be one of: codex, claude, gemini.`);
}

function readOptionalString(raw: Record<string, unknown>, key: string, sourcePath: string): string | undefined {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${sourcePath}.${key} must be a string.`);
  }

  return value;
}

function readOptionalStringArray(raw: Record<string, unknown>, key: string, sourcePath: string): readonly string[] | undefined {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${sourcePath}.${key} must be an array of strings.`);
  }

  if (value.some((entry) => entry.trim() === "")) {
    throw new Error(`${sourcePath}.${key} must not contain empty commands.`);
  }

  return value;
}

function isSafeRelativePath(path: string): boolean {
  const parts = path.split(/[\\/]/u);
  return path.trim() !== "" && !path.startsWith("/") && !parts.some((part) => part === "" || part === "." || part === "..");
}
