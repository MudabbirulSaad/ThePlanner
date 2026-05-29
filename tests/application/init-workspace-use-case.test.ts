import { describe, expect, it } from "vitest";

import { initWorkspaceUseCase } from "../../src/application/index.js";
import type { WorkspaceEntryStatus, WorkspaceInitializer } from "../../src/application/index.js";

class FakeWorkspaceInitializer implements WorkspaceInitializer {
  public readonly files = new Map<string, string>();
  public readonly directories = new Set<string>();

  public async ensureDirectory(path: string): Promise<WorkspaceEntryStatus> {
    const status = this.directories.has(path) ? "existing" : "created";
    this.directories.add(path);
    return status;
  }

  public async writeFileIfMissing(path: string, content: string): Promise<WorkspaceEntryStatus> {
    if (this.files.has(path)) {
      return "existing";
    }

    this.files.set(path, content);
    return "created";
  }
}

describe("init workspace use case", () => {
  it("creates the starter planning workspace entries", async () => {
    const initializer = new FakeWorkspaceInitializer();

    const result = await initWorkspaceUseCase(initializer);

    expect(result.created).toEqual([
      "planning",
      "planning/intake",
      "planning/work-items",
      "planning/execution-slices",
      "docs/prd",
      "docs/rfc",
      "docs/architecture",
      "planning/intake/idea.md",
      "planning/change-log.ndjson",
      "planning/graph.json"
    ]);
    expect(JSON.parse(initializer.files.get("planning/graph.json") ?? "{}")).toMatchObject({
      schema_version: "0.1.0",
      graph_version: 1,
      source: "starter-workspace"
    });
  });

  it("reports existing files without overwriting user content", async () => {
    const initializer = new FakeWorkspaceInitializer();
    await initWorkspaceUseCase(initializer);
    initializer.files.set("planning/intake/idea.md", "user idea\n");
    initializer.files.set("planning/graph.json", "{\"user\":true}\n");

    const result = await initWorkspaceUseCase(initializer);

    expect(result.created).toEqual([]);
    expect(result.existing).toContain("planning/intake/idea.md");
    expect(result.existing).toContain("planning/graph.json");
    expect(initializer.files.get("planning/intake/idea.md")).toBe("user idea\n");
    expect(initializer.files.get("planning/graph.json")).toBe("{\"user\":true}\n");
  });
});
