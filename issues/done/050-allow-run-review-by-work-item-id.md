# Issue 050: Allow Run Review By Work Item ID

## Type

AFK

## Complexity

Low

## Primary User Effort

Low

## Goal

Let `run review` accept a Work Item ID and resolve it to the latest reviewable executed run.

## User Story

As a Primary User, I want to review the latest run for a Work Item without manually searching run directories, so the review workflow follows the Work Item I am already working from.

## Scope

- Keep `run review <run-id>` working exactly as it does today.
- Add support for `run review <work-item-id>` by resolving the latest reviewable executed run for that Work Item.
- Exclude prepared-only runs from reviewable run resolution.
- Return useful error output when no executed runs exist or multiple candidates require clarification.
- Add CLI and use-case coverage for run ID lookup, Work Item ID lookup, missing runs, and prepared-only runs.

## Non-Goals

- Do not change `run accept` or `run reject` unless needed for shared lookup helpers.
- Do not mark Work Items done.
- Do not auto-accept or auto-reject runs.
- Do not require Git history.

## Implementation Notes

- Dogfooding showed `run review wi-001 --json` fails because review expects a run ID.
- Put artifact discovery behind an application seam or filesystem adapter method; avoid leaking run directory naming rules into CLI parsing.
- Prefer deterministic ordering by generated timestamp and run ID.

## Acceptance Criteria

- `run review <run-id> --json` remains compatible.
- `run review <work-item-id> --json` returns the latest reviewable executed run for that Work Item.
- Prepared-only run artifacts return a clear "prepared but not executed" or "no reviewable run" result.
- Error output lists candidate run IDs or next steps where useful.
- Tests cover successful Work Item lookup and missing/prepared-only failure paths.

## Blocked by

None - can start immediately.

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
issues/done/050-allow-run-review-by-work-item-id.md
```
