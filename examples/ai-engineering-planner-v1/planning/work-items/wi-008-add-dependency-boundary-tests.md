---
id: wi-008
title: Add dependency-boundary tests
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: []
blocks: []
requirements: [req-005]
hitl_gates: []
---

# Add dependency-boundary tests

## Context

Add dependency-boundary tests supports the V1 AI Engineering Planner implementation.

## Desired Outcome

Tests fail if src/core imports adapters, CLI, filesystem, Git, LLM, Repo Scan, or schema adapter code

## Boundaries / Non-goals

Keep implementation inside this Work Item's accepted slice.

## Acceptance Criteria

- Tests fail if src/core imports adapters, CLI, filesystem, Git, LLM, Repo Scan, or schema adapter code
- Boundary tests run in npm test or npm run lint

## Validation

- npm run check

## Dependencies

No unresolved dependencies.

## HITL Gates

None.

## Agent Notes

Use the Planning Graph as the source of truth.
