---
id: wi-006
title: Implement graph reconciliation workflow
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-004]
blocks: []
requirements: [req-004]
decisions: [dec-001, dec-002, dec-003]
components: [comp-001, comp-002, comp-004]
risks: []
hitl_gates: []
validation:
  - type: command
    command: npm test
    expected_result: Reconciliation fixture tests pass
rollback: If reconciliation is ambiguous, do not mutate graph; emit proposed patches and conflicts.
---

# Implement graph reconciliation workflow

## Context

Exported Markdown is a valid input signal after export, but the Planning Graph remains canonical.

## Desired Outcome

Detect edits in exported artifacts and propose graph patches, regeneration, Open Questions, Decisions, Work Item updates, or conflicts.

## Boundaries / Non-goals

Do not blindly overwrite manual edits. Do not mutate canonical graph without explicit `--apply` where required.

## Acceptance Criteria

- Edited projections produce proposed graph patches or conflicts
- Mutating reconciliation requires --apply
- Manual useful intent is preserved

## Validation

Run `npm test`; reconciliation fixture tests should pass.

## Dependencies

Completed after `wi-004` in `slice-003`.

## HITL Gates

None.

## Agent Notes

Prefer conservative conflict reporting over guessing when edits are ambiguous.
