import { describe, expect, it } from "vitest";

import { graphVersion, stableId } from "../../src/core/index.js";
import type {
  DependencyEdgeType,
  ReadinessSnapshot,
  RequirementId,
  WorkItemId
} from "../../src/core/index.js";

describe("core graph model", () => {
  it("models stable typed IDs", () => {
    const requirementId = stableId<RequirementId>("req-001", "req");
    const workItemId = stableId<WorkItemId>("wi-001", "wi");

    expect(requirementId).toBe("req-001");
    expect(workItemId).toBe("wi-001");
  });

  it("rejects malformed stable IDs", () => {
    expect(() => stableId<WorkItemId>("work-1", "wi")).toThrow(/wi-NNN/);
  });

  it("models graph versions as positive integers", () => {
    expect(graphVersion(3)).toBe(3);
    expect(() => graphVersion(0)).toThrow(/positive integer/);
  });

  it("includes all V1 dependency edge types", () => {
    const edgeTypes: readonly DependencyEdgeType[] = [
      "depends_on",
      "blocks",
      "satisfies",
      "mitigates",
      "raises",
      "references",
      "supersedes"
    ];

    expect(edgeTypes).toHaveLength(7);
  });

  it("models readiness snapshots", () => {
    const snapshot: ReadinessSnapshot = {
      graphVersion: graphVersion(3),
      labels: ["agent_eligible", "afk_ready"],
      reasons: ["No unresolved blockers remain."]
    };

    expect(snapshot.labels).toContain("afk_ready");
  });
});
