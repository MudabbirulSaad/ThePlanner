# Issue 042: Honor Non-Blocking Open Question Markers

## Goal

Make refined brief Open Question parsing respect explicit non-blocking language so the planner does not incorrectly HITL-gate executable Work Items.

## User Story

As a Primary User, I want `Blocks execution: no` in a refined brief to remain non-blocking in the Planning Graph, so normal follow-up questions do not prevent agent preparation and execution.

## Scope

- Update Open Question parsing to recognize explicit blocking fields such as `Blocks execution: yes`, `Blocks execution: no`, `Blocking: true`, and `Blocking: false`.
- Ensure explicit negative markers override phrase-based blocking detection.
- Preserve current conservative behavior for open questions without an explicit marker.
- Keep generated priority deterministic and aligned with the final `blocks_execution` value.
- Add core and CLI/integration coverage using a refined brief with both blocking and non-blocking open questions.

## Non-Goals

- Do not introduce LLM interpretation for freeform questions.
- Do not change HITL Gate derivation for genuinely blocking questions.
- Do not change graph schema fields.

## Implementation Notes

- This is a correctness bug found during dogfooding: `Blocks execution: no` was parsed as blocking because the phrase contained `Blocks execution`.
- Prefer a small parser for field-like suffixes over broad regex changes that weaken safety.
- Tests should prove non-blocking open questions do not create HITL Gates or Work Item blockers.

## Acceptance Criteria

- A refined brief line ending in `Blocks execution: no` creates an Open Question with `blocks_execution: false`.
- A refined brief line ending in `Blocks execution: yes` still creates an execution-blocking Open Question and derived HITL Gate.
- `validate --json` reports generated Work Items as unblocked by non-blocking Open Questions.
- Existing blocking uncertainty tests continue to pass.

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
issues/done/042-honor-non-blocking-open-question-markers.md
```
