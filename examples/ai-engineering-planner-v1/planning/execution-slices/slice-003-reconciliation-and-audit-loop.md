---
id: slice-003
title: Reconciliation and audit loop
graph_version: 6
work_items: [wi-006, wi-007]
readiness: done
---

# Reconciliation and audit loop

## Target Outcome

Detect edited exported artifacts, propose safe graph patches, and record meaningful graph changes and approvals.

## Dependency Closure

- `wi-004` complete for projection metadata.
- `wi-005` complete for CLI command flow.

## Validation Method

Run reconciliation fixture tests and change-log tests with `npm test`.

## Unresolved Blockers

None. `wi-006` and `wi-007` are complete.

## Linked Requirements / Decisions

- Requirements: `req-001`, `req-004`
- Decisions: `dec-001`, `dec-002`, `dec-003`
