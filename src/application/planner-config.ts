import type { SupportedAgent } from "./agent-context-bundle.js";

export interface PlannerConfig {
  readonly planningDirectory: string;
  readonly defaultAgent: SupportedAgent;
  readonly agentCommands: Readonly<Record<SupportedAgent, string>>;
  readonly validationCommands: readonly string[];
  readonly agentRunnerTimeoutMs: number;
  readonly validationCommandTimeoutMs: number;
  readonly processOutputLimitBytes: number;
}

export const defaultPlannerConfig: PlannerConfig = {
  planningDirectory: "planning",
  defaultAgent: "codex",
  agentCommands: {
    codex: "codex exec -",
    claude: "claude",
    gemini: "gemini"
  },
  validationCommands: [],
  agentRunnerTimeoutMs: 30 * 60 * 1000,
  validationCommandTimeoutMs: 10 * 60 * 1000,
  processOutputLimitBytes: 1024 * 1024
};

export function serializePlannerConfigJson(config: PlannerConfig = defaultPlannerConfig): string {
  return `${JSON.stringify(
    {
      planningDirectory: config.planningDirectory,
      defaultAgent: config.defaultAgent,
      agentCommands: {
        codex: config.agentCommands.codex,
        claude: config.agentCommands.claude,
        gemini: config.agentCommands.gemini
      },
      validationCommands: config.validationCommands,
      agentRunnerTimeoutMs: config.agentRunnerTimeoutMs,
      validationCommandTimeoutMs: config.validationCommandTimeoutMs,
      processOutputLimitBytes: config.processOutputLimitBytes
    },
    null,
    2
  )}\n`;
}

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
  const agentRunnerTimeoutMs =
    readOptionalPositiveInteger(raw, "agentRunnerTimeoutMs", sourcePath) ?? defaultPlannerConfig.agentRunnerTimeoutMs;
  const validationCommandTimeoutMs =
    readOptionalPositiveInteger(raw, "validationCommandTimeoutMs", sourcePath) ??
    defaultPlannerConfig.validationCommandTimeoutMs;
  const processOutputLimitBytes =
    readOptionalPositiveInteger(raw, "processOutputLimitBytes", sourcePath) ?? defaultPlannerConfig.processOutputLimitBytes;

  return {
    planningDirectory,
    defaultAgent,
    agentCommands,
    validationCommands,
    agentRunnerTimeoutMs,
    validationCommandTimeoutMs,
    processOutputLimitBytes
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

function readOptionalPositiveInteger(raw: Record<string, unknown>, key: string, sourcePath: string): number | undefined {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${sourcePath}.${key} must be a positive integer.`);
  }

  return value;
}

function isSafeRelativePath(path: string): boolean {
  const parts = path.split(/[\\/]/u);
  return path.trim() !== "" && !path.startsWith("/") && !parts.some((part) => part === "" || part === "." || part === "..");
}
