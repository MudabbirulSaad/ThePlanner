---
id: wi-002
title: Implement core graph types and stable IDs
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-001]
blocks: [wi-003, wi-004]
requirements: [req-001]
hitl_gates: []
---

# Implement core graph types and stable IDs

## Context

Implement core graph types and stable IDs supports the V1 AI Engineering Planner implementation.

## Desired Outcome

Core defines V1 node and edge types

## Boundaries / Non-goals

Keep implementation inside this Work Item's accepted slice.

## Acceptance Criteria

- Core defines V1 node and edge types
- Stable typed IDs are modeled
- Archived node metadata is represented

## Validation

- npm test

## Dependencies

Depends on `wi-001`.

## HITL Gates

None.

## Agent Notes

Use the Planning Graph as the source of truth.
