# Issue 052: Separate Prepared Context From Executed Runs

## Type

AFK

## Complexity

Medium-High

## Primary User Effort

Medium

## Goal

Make prepared context, executed runs, reviewable runs, accepted runs, and rejected runs explicit states in the run lifecycle.

## User Story

As a Primary User, I want ThePlanner to distinguish prepared context from executed agent runs, so review, accept, and reject commands explain what state the run is in and what action is valid next.

## Scope

- Represent prepared-only run artifacts as a distinct state from executed run artifacts.
- Make `run review` return a clear state-specific result for prepared-only artifacts instead of a generic missing-artifact failure.
- Preserve existing behavior for executed runs, failed validation runs, accepted runs, and rejected runs.
- Add tests across the run lifecycle states exposed by the public command/use-case Interface.

## Non-Goals

- Do not execute agents from `prepare`.
- Do not auto-promote prepared context to an executed run.
- Do not change Graph Operation reviewer policy.
- Do not require live LLM providers or external services.

## Implementation Notes

- `prepare --apply` creates context metadata but not runner or validation results.
- The run lifecycle Module should concentrate state interpretation instead of forcing CLI callers to infer state from missing files.
- Coordinate with Work Item ID lookup behavior so prepared-only runs are not treated as reviewable executed runs.

## Acceptance Criteria

- Prepared-only artifacts produce a clear prepared/not-executed state when reviewed.
- Executed passing and failing runs remain reviewable.
- Accepted and rejected decisions remain recorded through the Planning Change Log.
- Public JSON output exposes stable status values for each lifecycle state.
- Tests cover prepared-only, executed-pass, executed-fail, accepted, and rejected paths.

## Blocked by

- Issue 050: Allow Run Review By Work Item ID

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
issues/done/052-separate-prepared-context-from-executed-runs.md
```
