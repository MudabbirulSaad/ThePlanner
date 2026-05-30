# Issue 035: Add Graph Operation Apply Command

## Goal

Expose the Graph Operation pipeline through a deterministic CLI dry-run/apply command so proposed operation JSON can be reviewed, validated, and safely applied.

## User Story

As a Primary User, I want to inspect proposed graph operations before applying them, so canonical planning state changes only after validation and explicit apply.

## Scope

- Add a CLI command for reading proposed graph operation JSON from a file.
- Support dry-run output that reports candidate graph changes, validation status, approval requirements, affected node IDs, and no file writes.
- Support apply only when operations are valid and no required approval is missing.
- Save `planning/graph.json` and append `planning/change-log.ndjson` only on successful apply.
- Preserve existing export behavior; projection regeneration can remain a separate command unless the codebase already has a safe internal pattern.
- Add CLI integration tests for dry-run, apply, invalid operation, and approval-required refusal.

## Non-Goals

- Do not add live LLM providers.
- Do not add interactive prompts.
- Do not auto-commit Git changes.
- Do not silently apply approval-required operations.

## Implementation Notes

- Keep command naming consistent with the existing CLI style.
- Dry-run JSON should be useful for agents and humans.
- Change-log events should include operation type, graph version before/after, affected nodes, approval status, and provenance reference.
- Approval ergonomics: approval must remain strictly non-interactive and file-based for AFK use. The CLI should reject unapproved operations and require either an explicit approved field in the proposal JSON, such as `"approved": true`, or a strict CLI approval flag before `--apply` succeeds.

## Acceptance Criteria

- Dry-run validates proposed operations and reports candidate changes without writing graph or projection files.
- Apply writes the graph and change-log only for valid, approved operations.
- Approval-required operations are refused unless the issue establishes an explicit approved input shape.
- CLI integration tests prove invalid operations do not mutate files.

## Blocked by

- Issue 034: Add Dependency and HITL Graph Operations

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
```

## Completion

When complete, move this file to:

```text
issues/done/035-add-graph-operation-apply-command.md
```
