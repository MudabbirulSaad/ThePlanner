# Issue 013: Add Run Review Accept Reject Workflow

## Goal

Add explicit human review around agent runs before planning state changes.

## User Story

As a user, I want to accept or reject an agent run, so the planner does not silently treat an agent attempt as completed work.

## Scope

- Add commands such as:

```sh
planner run review <run-id> --json
planner run accept <run-id> --json
planner run reject <run-id> --json
```

- Review should summarize:
  - Work Item
  - changed files if available
  - agent exit code
  - validation results
  - run artifacts
- Accept/reject should append change-log events.
- Only update Work Item state if there is a clearly defined safe rule.

## Non-Goals

- Do not auto-commit.
- Do not sync trackers.
- Do not implement web UI.

## Implementation Notes

- Be conservative. Human approval is the boundary.
- Keep change-log events coherent and audit-friendly.

## Acceptance Criteria

- Review command reads saved run metadata.
- Accept/reject events are appended to the change log.
- Invalid run ids produce useful errors.
- Tests cover accept and reject paths.

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
issues/done/013-run-review-accept-reject.md
```

