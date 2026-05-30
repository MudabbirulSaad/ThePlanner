# Issue 026: Derive HITL Gates From Blocking Uncertainty

## Goal

Turn high-impact uncertainty into explicit HITL Gates so agent execution is blocked for the right reasons.

## User Story

As a Primary User, I want unresolved assumptions, risks, and open questions that affect execution to become visible HITL Gates, so the planner can explain exactly what human input is needed before AFK execution.

## Scope

- Derive HITL Gates from blocking assumptions, high-impact risks, unresolved Decisions, and execution-blocking Open Questions during planning from a brief.
- Link derived HITL Gates to affected Work Items.
- Validate HITL Gates have clear required actions and cause links.
- Render derived HITL Gates in Work Item projections and dependency views.
- Add regression tests for each blocking uncertainty source.

## Non-Goals

- Do not require every Open Question to block execution.
- Do not add live chat or interactive clarification in this issue.
- Do not run agents automatically.

## Implementation Notes

- The distinction matters: Open Questions can be non-blocking; HITL Gates block safe progress.
- Prefer deterministic cause strings that are useful in CLI JSON and Markdown output.

## Acceptance Criteria

- Planning from a refined brief can create HITL Gates when uncertainty blocks execution.
- Affected Work Items are marked hitl-gated or blocked by validation.
- Work Item projections show the relevant HITL Gate instead of always rendering `None`.
- Tests cover assumption, risk, decision, and open-question blocking cases.

## Blocked by

- None - can start immediately

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
issues/done/026-derive-hitl-gates-from-blocking-uncertainty.md
```
