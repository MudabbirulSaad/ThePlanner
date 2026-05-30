# Issue 037: Add Grilling Session Open Question Flow

## Goal

Turn missing intake context into proposed Open Questions through the GraphOperationProposer path, then accept user answers as source material for follow-up proposals.

## User Story

As a Primary User, I want the planner to ask focused questions when an LLM lacks context, so it does not invent Requirements or Decisions from ambiguity.

## Scope

- Add a dry-run grilling flow that asks a proposer for Open Question proposals from an Intake Brief.
- Render proposed Open Questions in human-readable and JSON output.
- Add a way to feed user answers back into the proposal use case as source material.
- Verify answer-fed proposals can produce Requirements or Decisions only through Proposed Graph Operations.
- Add tests for missing-context proposals and answer-driven follow-up proposals using fake proposers.

## Non-Goals

- Do not implement live chat with providers.
- Do not add terminal interactivity unless already consistent with CLI patterns.
- Do not auto-accept Decisions from answers without approval classification.
- Do not mutate graph state during dry-run.

## Implementation Notes

- This issue can use files for intake and answer input to stay deterministic and AFK-friendly.
- Keep output suitable for future provider adapters and human review.
- Preserve current `intake questions` and `intake refine` behavior unless explicitly extending it.

## Acceptance Criteria

- A dry-run grilling command or use case returns proposed Open Questions from an Intake Brief.
- User answers can be provided as follow-up input to generate proposed graph operations.
- Commitment-changing follow-up proposals are marked as approval-required.
- Tests prove no graph or projection files are written in dry-run.

## Blocked by

- Issue 036: Add Graph Operation Proposer Port

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
issues/done/037-add-grilling-session-open-question-flow.md
```
