import { describe, expect, it } from "vitest";

import { defaultPlannerConfig, parsePlannerConfig, serializePlannerConfigJson } from "../../src/application/index.js";

describe("planner config", () => {
  it("uses deterministic defaults when no config file is present", () => {
    expect(parsePlannerConfig(undefined)).toEqual(defaultPlannerConfig);
  });

  it("serializes defaults with deterministic key order", () => {
    expect(serializePlannerConfigJson()).toBe(`{
  "planningDirectory": "planning",
  "defaultAgent": "codex",
  "agentCommands": {
    "codex": "codex exec -",
    "claude": "claude",
    "gemini": "gemini"
  },
  "validationCommands": [],
  "agentRunnerTimeoutMs": 1800000,
  "validationCommandTimeoutMs": 600000,
  "processOutputLimitBytes": 1048576
}
`);
  });

  it("merges project config with defaults", () => {
    expect(
      parsePlannerConfig({
        planningDirectory: "project-planning",
        defaultAgent: "claude",
        agentCommands: {
          claude: "/opt/claude",
          gemini: "npx gemini"
        },
        validationCommands: ["npm test", "npm run lint"],
        agentRunnerTimeoutMs: 1234,
        validationCommandTimeoutMs: 5678,
        processOutputLimitBytes: 90
      })
    ).toEqual({
      planningDirectory: "project-planning",
      defaultAgent: "claude",
      agentCommands: {
        codex: "codex exec -",
        claude: "/opt/claude",
        gemini: "npx gemini"
      },
      validationCommands: ["npm test", "npm run lint"],
      agentRunnerTimeoutMs: 1234,
      validationCommandTimeoutMs: 5678,
      processOutputLimitBytes: 90
    });
  });

  it("rejects invalid config with useful field-level errors", () => {
    expect(() => parsePlannerConfig({ planningDirectory: "../outside" })).toThrow(
      'planner.config.json.planningDirectory must be a non-empty relative path without "." or ".." segments.'
    );
    expect(() => parsePlannerConfig({ defaultAgent: "unknown" })).toThrow(
      "planner.config.json.defaultAgent must be one of: codex, claude, gemini."
    );
    expect(() => parsePlannerConfig({ validationCommands: [""] })).toThrow(
      "planner.config.json.validationCommands must not contain empty commands."
    );
    expect(() => parsePlannerConfig({ agentRunnerTimeoutMs: 0 })).toThrow(
      "planner.config.json.agentRunnerTimeoutMs must be a positive integer."
    );
    expect(() => parsePlannerConfig({ validationCommandTimeoutMs: 1.5 })).toThrow(
      "planner.config.json.validationCommandTimeoutMs must be a positive integer."
    );
    expect(() => parsePlannerConfig({ processOutputLimitBytes: -1 })).toThrow(
      "planner.config.json.processOutputLimitBytes must be a positive integer."
    );
  });
});
