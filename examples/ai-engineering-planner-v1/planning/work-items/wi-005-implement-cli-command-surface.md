---
id: wi-005
title: Implement CLI command surface
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-003]
blocks: [wi-007]
requirements: [req-006]
hitl_gates: []
---

# Implement CLI command surface

## Context

Implement CLI command surface supports the V1 AI Engineering Planner implementation.

## Desired Outcome

planner plan, validate, export, reconcile, and status commands exist

## Boundaries / Non-goals

Keep implementation inside this Work Item's accepted slice.

## Acceptance Criteria

- planner plan, validate, export, reconcile, and status commands exist
- Commands support --json and deterministic paths
- Validation failures use non-zero exit codes

## Validation

- npm test

## Dependencies

Depends on `wi-003`.

## HITL Gates

None.

## Agent Notes

Use the Planning Graph as the source of truth.
