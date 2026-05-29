import { describe, expect, it } from "vitest";

import { refineIntakeBriefUseCase } from "../../src/application/index.js";
import type { IntakeIdeaReader, RefinedBriefWriter, RefinedBriefWriteStatus } from "../../src/application/index.js";

class FakeIntakeIdeaReader implements IntakeIdeaReader {
  public constructor(private readonly content: string) {}

  public async read(): Promise<string> {
    return this.content;
  }
}

class FakeRefinedBriefWriter implements RefinedBriefWriter {
  public readonly files = new Map<string, string>();

  public async write(
    path: string,
    content: string,
    options: { readonly overwrite?: boolean } = {}
  ): Promise<RefinedBriefWriteStatus> {
    if (this.files.has(path) && !options.overwrite) {
      return "skipped";
    }

    const status = this.files.has(path) ? "overwritten" : "created";
    this.files.set(path, content);
    return status;
  }
}

describe("refine intake brief use case", () => {
  it("creates a deterministic refined brief scaffold from an intake idea", async () => {
    const writer = new FakeRefinedBriefWriter();

    const result = await refineIntakeBriefUseCase({
      intakeIdeaReader: new FakeIntakeIdeaReader("Build a planner for AI engineering work.\n"),
      refinedBriefWriter: writer,
      fromPath: "planning/intake/idea.md",
      outPath: "planning/intake/refined-brief.md"
    });

    expect(result).toMatchObject({
      status: "created",
      created: ["planning/intake/refined-brief.md"],
      skipped: [],
      sourcePath: "planning/intake/idea.md",
      outPath: "planning/intake/refined-brief.md",
      deferred: true
    });
    expect(writer.files.get("planning/intake/refined-brief.md")).toMatchInlineSnapshot(`
      "# Refined Brief

      Source idea: planning/intake/idea.md

      This Markdown file is user-owned. Fill in the TODOs before running graph planning.

      ## Raw Idea

      \`\`\`
      Build a planner for AI engineering work.
      \`\`\`

      ## Product Summary

      TODO: Summarize the product, problem, and intended outcome in a few paragraphs.

      ## Users

      TODO: Identify primary users, secondary users, and users explicitly out of scope.

      ## Goals

      TODO: List the concrete user and business outcomes this version should achieve.

      ## MVP Scope

      TODO: Define the smallest coherent product scope for the first planning graph.

      ## Non-Goals

      TODO: List capabilities, audiences, integrations, or quality bars intentionally deferred.

      ## Constraints

      TODO: Capture technical, legal, operational, design, timeline, and team constraints.

      ## Success Criteria

      TODO: Describe measurable signals that indicate the MVP solved the right problem.

      ## Open Questions

      TODO: Track unresolved decisions and information needed before graph planning.
      "
    `);
  });

  it("preserves an existing refined brief unless force is requested", async () => {
    const writer = new FakeRefinedBriefWriter();
    writer.files.set("planning/intake/refined-brief.md", "user-owned brief\n");

    const skipped = await refineIntakeBriefUseCase({
      intakeIdeaReader: new FakeIntakeIdeaReader("New idea\n"),
      refinedBriefWriter: writer,
      fromPath: "planning/intake/idea.md",
      outPath: "planning/intake/refined-brief.md"
    });

    expect(skipped.status).toBe("skipped");
    expect(skipped.skipped).toEqual(["planning/intake/refined-brief.md"]);
    expect(writer.files.get("planning/intake/refined-brief.md")).toBe("user-owned brief\n");

    const overwritten = await refineIntakeBriefUseCase({
      intakeIdeaReader: new FakeIntakeIdeaReader("New idea\n"),
      refinedBriefWriter: writer,
      fromPath: "planning/intake/idea.md",
      outPath: "planning/intake/refined-brief.md",
      force: true
    });

    expect(overwritten.status).toBe("overwritten");
    expect(overwritten.overwritten).toEqual(["planning/intake/refined-brief.md"]);
    expect(writer.files.get("planning/intake/refined-brief.md")).toContain("New idea");
  });
});
