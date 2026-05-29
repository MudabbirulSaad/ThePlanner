# Issue 016: Add External Tracker Sync Dry Run

## Goal

Add the first safe boundary for syncing Work Items to an external tracker without mutating external systems.

## User Story

As a user, I want to preview how Work Items would map to GitHub Issues or another tracker, so team workflows can be planned safely.

## Scope

- Add a tracker sync port.
- Add a dry-run command such as:

```sh
planner sync github --dry-run --json
```

- Output proposed external issues with:
  - title
  - body
  - labels
  - dependencies/references
- Add tests with fake tracker adapter.

## Non-Goals

- Do not call GitHub/Linear/Jira live.
- Do not create external issues.
- Do not require credentials.

## Implementation Notes

- This is a production-roadmap issue, not required before local agent workflow.
- Keep external sync behind adapters.

## Acceptance Criteria

- Dry-run produces deterministic proposed tracker payloads.
- No network calls occur in tests.
- Docs state that live sync is deferred.

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
issues/done/016-external-tracker-sync-dry-run.md
```

