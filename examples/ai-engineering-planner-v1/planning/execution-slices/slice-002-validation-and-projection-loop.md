---
id: slice-002
title: Validation and projection loop
graph_version: 6
work_items: [wi-003, wi-004, wi-005]
readiness: done
---

# Validation and projection loop

## Target Outcome

Implement semantic validation, readiness derivation, projection rendering, and CLI commands for validate/export/status flows.

## Dependency Closure

- `wi-002` complete after `slice-001`.

## Validation Method

Run `npm test` and CLI integration tests for deterministic files and exit codes.

## Unresolved Blockers

None. `wi-003`, `wi-004`, and `wi-005` are complete.

## Linked Requirements / Decisions

- Requirements: `req-002`, `req-003`, `req-006`
- Decisions: `dec-001`, `dec-002`, `dec-003`, `dec-004`
