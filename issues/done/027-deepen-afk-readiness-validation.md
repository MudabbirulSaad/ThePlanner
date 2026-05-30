# Issue 027: Deepen AFK Readiness Validation

## Goal

Make AFK-ready mean a Work Item has enough context, boundaries, validation, dependencies, and safe-failure guidance for autonomous agent attempt.

## User Story

As a Primary User, I want AFK-ready labels to be stricter than "not blocked", so I can trust `theplanner run` to execute only well-scoped Work Items.

## Scope

- Add deterministic readiness checks for context completeness, boundaries/non-goals, validation strength, dependency closure, and safe-failure expectations.
- Report specific readiness reasons when a Work Item is agent-eligible but not AFK-ready.
- Update Work Item projections and agent context bundles to expose the relevant readiness details.
- Add regression tests for every new AFK blocking condition.

## Non-Goals

- Do not execute agents differently in this issue.
- Do not add OS-level sandboxing.
- Do not require live provider calls or external services.

## Implementation Notes

- Keep `agent_eligible` separate from `afk_ready`.
- Manual-review validation may be acceptable for prepare, but should usually block autonomous `run` unless the Work Item has executable validation or explicitly documented safe manual validation behavior.

## Acceptance Criteria

- Work Items missing context, boundaries, validation, dependency closure, or safe-failure guidance are not AFK-ready.
- CLI validation output includes actionable readiness reasons.
- `theplanner run` continues to reject non-AFK Work Items using derived readiness.
- Tests cover each blocking condition and at least one passing AFK-ready Work Item.

## Blocked by

- Issue 026: Derive HITL Gates From Blocking Uncertainty

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
issues/done/027-deepen-afk-readiness-validation.md
```
