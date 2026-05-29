---
id: wi-006
title: Implement graph reconciliation workflow
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-004]
blocks: []
requirements: [req-004]
hitl_gates: []
---

# Implement graph reconciliation workflow

## Context

Implement graph reconciliation workflow supports the V1 AI Engineering Planner implementation.

## Desired Outcome

Edited projections produce proposed graph patches or conflicts

## Boundaries / Non-goals

Keep implementation inside this Work Item's accepted slice.

## Acceptance Criteria

- Edited projections produce proposed graph patches or conflicts
- Mutating reconciliation requires --apply
- Manual useful intent is preserved

## Validation

- npm test

## Dependencies

Depends on `wi-004`.

## HITL Gates

None.

## Agent Notes

Use the Planning Graph as the source of truth.
