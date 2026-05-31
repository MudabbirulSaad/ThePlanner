# Issue 049: Keep Scaffolded Work Items Out Of AFK-Ready

## Type

AFK

## Complexity

Medium

## Primary User Effort

Low

## Goal

Prevent deterministic fallback Work Items from becoming AFK-ready until their context, validation, and provenance are strong enough for autonomous execution.

## User Story

As a Primary User, I want AFK-ready to exclude scaffold-generated placeholder Work Items, so coding agents only run when the Work Item is concrete, traceable, bounded, and verifiable.

## Scope

- Extend readiness or planning-quality logic so fallback/scaffold Work Items remain at most Agent-eligible.
- Detect placeholder provenance, fallback titles, TODO-derived Product Intent, or safe-manual-validation text that exists only because the deterministic scaffold filled blanks.
- Preserve the existing deep AFK readiness behavior for genuinely enriched Work Items.
- Add regression tests proving scaffolded Work Items are not AFK-ready and confirmed Work Items can still be AFK-ready.

## Non-Goals

- Do not remove deterministic scaffold planning.
- Do not require live LLM provider calls.
- Do not make all manual-review Validation Methods invalid.
- Do not change execution state semantics.

## Implementation Notes

- Issue 027 already deepened AFK readiness. This issue closes the remaining provenance and placeholder gap.
- A Work Item enriched through accepted Graph Operations, explicit user-authored context, or executable Validation Methods should still be able to pass AFK readiness.
- Keep deterministic Graph Validation as the final authority for AFK-ready labels.

## Acceptance Criteria

- A fallback Work Item such as "Implement the smallest coherent MVP workflow described by the refined brief" is not AFK-ready by default.
- TODO-filled Product Intent prevents affected Work Items from becoming AFK-ready.
- A Work Item with confirmed context, boundary notes, traceability, safe-failure guidance, and executable Validation Method can still become AFK-ready.
- CLI validation output explains why scaffolded Work Items are blocked.
- Tests cover scaffolded, TODO-derived, and confirmed AFK-ready Work Item cases.

## Blocked by

- Issue 048: Reject Scaffold-Heavy Planning Graphs From Trusted Export

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
issues/done/049-keep-scaffolded-work-items-out-of-afk-ready.md
```
