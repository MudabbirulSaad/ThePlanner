# Issue 007: Add Safe Export Dry Run And Apply

## Goal

Make projection export safer for real use by separating preview from mutation.

## User Story

As a user, I want to preview projection changes before overwriting Markdown files, so human-authored notes are not lost accidentally.

## Scope

- Add:

```sh
planner export --dry-run --json
planner export --apply --json
```

- Preserve current behavior only if there is a compatibility decision, but document it clearly.
- Dry-run should report:
  - files that would be created
  - files that would be updated
  - unchanged files
  - possible human-authored sections that may be overwritten
- Add tests around dry-run not writing files.

## Non-Goals

- Do not implement full Markdown merge preservation unless required for safe dry-run output.
- Do not change reconciliation canonical truth rules.

## Implementation Notes

- Current export writes immediately. Production workflow needs preview-first behavior.
- Keep output deterministic and useful for code review.

## Acceptance Criteria

- Dry-run makes no filesystem changes.
- Apply writes projections.
- JSON output describes planned or completed writes.
- Docs warn about projection overwrite behavior.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
node dist/src/adapters/cli/index.js export --dry-run --json
```

## Completion

When complete, move this file to:

```text
issues/done/007-safe-export-dry-run-and-apply.md
```

