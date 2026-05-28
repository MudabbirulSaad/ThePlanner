---
id: wi-005
title: Implement CLI command surface
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-003]
blocks: [wi-007]
requirements: [req-006]
decisions: [dec-003, dec-004]
components: [comp-002, comp-003]
risks: []
hitl_gates: []
validation:
  - type: command
    command: npm test
    expected_result: CLI integration tests pass
rollback: If command wiring fails, report command, args, exit code, and changed files.
---

# Implement CLI command surface

## Context

The CLI must be agent-invocable and pipeline-friendly while delegating behavior to application use cases.

## Desired Outcome

Implement `planner plan`, `planner validate`, `planner export`, `planner reconcile`, and `planner status`.

## Boundaries / Non-goals

Do not let CLI code call core internals directly.

## Acceptance Criteria

- planner plan, validate, export, reconcile, and status commands exist
- Commands support --json and deterministic paths
- Validation failures use non-zero exit codes

## Validation

Run `npm test`; CLI integration tests should pass.

## Dependencies

Completed after `wi-003` in `slice-002`.

## HITL Gates

None.

## Agent Notes

Keep stdout machine-readable under `--json`; route progress logs to stderr where appropriate.
