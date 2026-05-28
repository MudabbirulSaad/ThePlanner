---
id: wi-003
title: Implement graph validation and readiness derivation
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-002]
blocks: [wi-005]
requirements: [req-003]
decisions: [dec-001, dec-003]
components: [comp-001, comp-005]
risks: [risk-002]
hitl_gates: []
validation:
  - type: command
    command: npm test
    expected_result: Validation and readiness tests pass
rollback: If validation rules fail, keep failing fixtures and report rule mismatch.
---

# Implement graph validation and readiness derivation

## Context

Graph Validation enforces traceability, dependencies, HITL clarity, risk impact, blocker causes, and AFK-ready eligibility.

## Desired Outcome

Implement semantic validation and readiness derivation with errors, warnings, and reasoned snapshots.

## Boundaries / Non-goals

Do not call JSON Schema adapters directly from core. Schema validation is adapter/application-layer behavior.

## Acceptance Criteria

- Validation reports errors and warnings
- AFK-ready cannot be forced when validation fails
- Every blocking condition has a regression test

## Validation

Run `npm test`; validation and readiness tests should pass.

## Dependencies

Completed after `wi-002` in `slice-002`.

## HITL Gates

None.

## Agent Notes

Readiness snapshots must include reasons, not just labels.
