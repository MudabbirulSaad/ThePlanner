---
id: wi-004
title: Implement projection rendering
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-002]
blocks: [wi-006]
requirements: [req-002]
decisions: [dec-001, dec-002, dec-003]
components: [comp-001, comp-004]
risks: []
hitl_gates: []
validation:
  - type: command
    command: npm test
    expected_result: Golden projection tests pass
rollback: If rendering partially fails, preserve existing artifacts and report failed projection.
---

# Implement projection rendering

## Context

Documents are projections of the Planning Graph, not independent sources of truth.

## Desired Outcome

Render PRD, RFC, architecture, Work Item, and Dependency View projections from graph input.

## Boundaries / Non-goals

Do not implement external tracker sync.

## Acceptance Criteria

- PRD, RFC, architecture, Work Item, and Dependency View projections render from graph input
- Work Item files include YAML frontmatter and required sections

## Validation

Run `npm test`; golden projection tests should pass.

## Dependencies

Completed after `wi-002` in `slice-002`.

## HITL Gates

None.

## Agent Notes

Use deterministic ordering to keep Git diffs stable.
