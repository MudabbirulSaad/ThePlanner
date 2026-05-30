# Issue 030: Reconcile Richer Document Projection Edits

## Goal

Let useful human edits to PRD, RFC, architecture, and Work Item projections become proposed Planning Graph changes instead of unsupported Markdown edits.

## User Story

As a Primary User, I want edits I make in generated Markdown to be surfaced as safe graph patch proposals, so the graph remains canonical without discarding human planning improvements.

## Scope

- Extend reconciliation to inspect richer projection sections beyond current Work Item scalar fields.
- Propose graph patches for supported Requirement, Decision, Component, Risk, Open Question, HITL Gate, and Work Item edits.
- Keep unsupported or ambiguous edits visible as unsupportedProjectionEdits or conflicts.
- Add apply behavior only for safe, deterministic patches.
- Add regression tests for supported patches, conflicts, and unsupported edits.

## Non-Goals

- Do not make Markdown projections canonical.
- Do not blindly ingest freeform prose.
- Do not call live LLM providers to interpret edits.

## Implementation Notes

- Start with a narrow supported subset that can be parsed deterministically.
- Preserve the existing dry-run/apply split and conflict behavior.
- This issue gets more valuable after richer projections exist, but can start with current projection fields if needed.

## Acceptance Criteria

- `theplanner reconcile --json` reports safe graph patches for at least one richer document edit type.
- `theplanner reconcile --apply --json` applies only safe patches and records a change-log event.
- Ambiguous edits remain conflicts or unsupported edits with useful explanations.
- Existing Work Item reconciliation behavior remains compatible.

## Blocked by

- Issue 022: Render Real PRD Projection
- Issue 024: Render Real Architecture Projection
- Issue 025: Add RFC Decision Planning Flow

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
issues/done/030-reconcile-richer-document-projection-edits.md
```
