import { describe, expect, it } from "vitest";

import { generateIntakeQuestions } from "../../src/core/index.js";

describe("intake question generation", () => {
  it("returns deterministic grouped grilling questions", () => {
    const result = generateIntakeQuestions("Build a tool for designers to refine client notes.");

    expect(result.groups.map((group) => group.id)).toEqual([
      "target_user",
      "problem",
      "mvp_scope",
      "non_goals",
      "constraints",
      "success_criteria",
      "risks_open_questions"
    ]);
    expect(result.groups).toHaveLength(7);
    expect(result.groups.every((group) => group.questions.length === 3)).toBe(true);
    expect(result.groups[0]?.questions[0]?.question).toBe(
      "Who is the primary target user, and what role or context are they in when they need this?"
    );
  });
});
