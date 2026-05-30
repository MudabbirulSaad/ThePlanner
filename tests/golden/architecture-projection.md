---
id: doc-001
projection_type: architecture
graph_version: 3
source_graph: planning/graph.json
---

# Planner Architecture

## Overview

Build a CLI-first planning tool with graph-backed projections.

Source graph: `planning/graph.json`. Graph version: 3.

## Components

- comp-001: Planning graph core. Responsibility: Own graph validation. Depends on: none.
- comp-002: Projection application service. Responsibility: Coordinate projection export use cases through ports. Depends on: `comp-001`.
- comp-003: Filesystem projection adapter. Responsibility: Persist rendered Markdown projections to workspace paths. Depends on: `comp-002`.

## Interfaces / Contracts

- comp-001: Domain API (internal) - Pure functions return validation results.
- comp-002: Projection writer port (outbound) - Accepts rendered projections and returns written paths.
- comp-003: None.

## Dependency Notes

- comp-002 depends on comp-001 (component dependency).
- comp-003 depends on comp-002 (component dependency).
- comp-003 depends on comp-002 (graph edge). Rationale: Adapter calls the application service contract.

## Constraints

- Product constraint: Core stays independent from adapters.
- comp-001: No filesystem access.
- comp-002: No direct process execution.

## Risks

- risk-001 (medium likelihood, high impact): Generated docs drift. Mitigation: Regenerate projections from the Planning Graph. Blocks AFK.
- comp-001: Schema drift can break projections.
- comp-003: Unsafe paths can escape the workspace.

## Open Questions

- oq-001 (medium priority): Which graph storage backend should be supported after local files? Does not block execution.

## Work Item Traceability

- wi-001: [Render architecture projection](planning/work-items/wi-001-render-architecture-projection.md). Components: `comp-001`, `comp-002`. Readiness: agent_eligible, afk_ready.
- wi-002: [Wire projection export](planning/work-items/wi-002-wire-projection-export.md). Components: `comp-003`. Readiness: agent_eligible.
