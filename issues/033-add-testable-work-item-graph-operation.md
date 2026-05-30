# Issue 033: Add Testable Work Item Graph Operation

## Goal

Allow Work Items to enter the Planning Graph through Graph Operations only when they are immediately testable and bounded enough for future agent execution.

## User Story

As a Primary User, I want LLM-proposed Work Items to be rejected when they lack acceptance criteria or executable validation, so untestable tasks cannot enter the AFK pipeline.

## Scope

- Add `AddWorkItem` operation support.
- Require acceptance criteria, executable command or test validation method, context summary, boundary notes, traceability, and safe-failure guidance for LLM-origin Work Item proposals.
- Reject vague manual-only validation for LLM-origin Work Item proposals.
- Add or preserve dependency edges from the Work Item to at least one Requirement or accepted Decision.
- Validate candidate graph readiness after operation application.
- Add regression tests for every required Work Item field.

## Non-Goals

- Do not implement provider prompts.
- Do not run coding agents.
- Do not make all human-authored Work Items require the stricter LLM-origin rule unless existing validation already requires it.
- Do not mark new Work Items AFK-ready by assertion; readiness remains derived.

## Implementation Notes

- The operation should carry provenance so validation can distinguish LLM-origin proposals from other graph changes if needed.
- Prefer command/test validation methods with explicit commands.
- Keep semantic validation errors specific enough for an AFK agent or Primary User to fix the proposal.

## Acceptance Criteria

- A complete `AddWorkItem` proposal creates a candidate Work Item with traceability and derived readiness.
- A Work Item proposal without acceptance criteria is rejected.
- A Work Item proposal without an executable validation command is rejected.
- A Work Item proposal without context, boundaries, traceability, or safe-failure guidance is rejected.
- Tests prove invalid Work Item proposals cannot be saved to the canonical graph.

## Blocked by

- Issue 032: Add Requirement and Decision Graph Operations

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
issues/done/033-add-testable-work-item-graph-operation.md
```
