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

Implement graph validation and readiness derivation supports ThePlanner V1 implementation.

## Desired Outcome

Validation reports errors and warnings

## Boundaries / Non-goals

- None

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

## Readiness Details

- Work Item is complete and already validated.

## Safe Failure

Stop and report the missing guidance before making changes.

## Agent Notes

Use the Planning Graph as the source of truth.
