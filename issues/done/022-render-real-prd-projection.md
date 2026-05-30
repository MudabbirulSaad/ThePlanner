# Issue 022: Render Real PRD Projection

## Goal

Upgrade the PRD Document Projection from a requirements list into a reviewable product requirements document.

## User Story

As a Primary User, I want `docs/prd/*.md` to read like a real PRD, so I can hand it to a human engineer, coding agent, or reviewer without rewriting it from scratch.

## Scope

- Render PRD sections for product summary, target users, goals, non-goals, requirements, success criteria, assumptions, open questions, risks, and Work Item traceability.
- Keep output deterministic and generated from the Planning Graph only.
- Add golden or integration coverage for the generated PRD output.
- Update README or demo docs if the PRD output shape changes meaningfully.

## Non-Goals

- Do not introduce an LLM dependency.
- Do not make Markdown projections canonical.
- Do not implement freeform PRD editing reconciliation in this issue.

## Implementation Notes

- This issue is blocked by Issue 021 if it needs new graph fields.
- Prefer readable Markdown that is still stable enough for golden tests.
- Preserve existing export dry-run/apply semantics and overwrite warnings.

## Acceptance Criteria

- Exporting projections produces a PRD with the major product-planning sections, not only a requirements list.
- The PRD includes graph IDs for traceability where useful.
- Existing `export --dry-run --json` and `export --apply --json` behavior remains deterministic.
- Tests cover at least one realistic graph with PRD-grade fields.

## Blocked by

- Issue 021: Add PRD Grade Planning Graph Fields

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
issues/done/022-render-real-prd-projection.md
```
