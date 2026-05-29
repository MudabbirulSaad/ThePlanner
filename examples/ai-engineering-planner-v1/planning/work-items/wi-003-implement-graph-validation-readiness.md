---
id: wi-003
title: Implement graph validation and readiness derivation
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-002]
blocks: [wi-005]
requirements: [req-003]
hitl_gates: []
---

# Implement graph validation and readiness derivation

## Context

Implement graph validation and readiness derivation supports the V1 AI Engineering Planner implementation.

## Desired Outcome

Validation reports errors and warnings

## Boundaries / Non-goals

Keep implementation inside this Work Item's accepted slice.

## Acceptance Criteria

- Validation reports errors and warnings
- AFK-ready cannot be forced when validation fails
- Every blocking condition has a regression test

## Validation

- npm test

## Dependencies

Depends on `wi-002`.

## HITL Gates

None.

## Agent Notes

Use the Planning Graph as the source of truth.
