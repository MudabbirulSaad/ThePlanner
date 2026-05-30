# Issue 021: Add PRD Grade Planning Graph Fields

## Goal

Make the Planning Graph carry enough product intent to generate a useful PRD instead of only listing inferred requirements.

## User Story

As a Primary User, I want the planner to preserve product summary, target users, goals, non-goals, constraints, and success criteria in the canonical graph, so generated PRD projections can be reviewed and improved from graph truth.

## Scope

- Add graph support for PRD-grade planning metadata while keeping `schema_version: "0.1.0"` behavior explicit.
- Preserve these fields when parsing and serializing `planning/graph.json`.
- Populate the fields from a refined brief in `theplanner plan --dry-run` and `--apply`.
- Include provenance or scaffold notes where the refined brief is missing important PRD inputs.
- Add unit and CLI integration coverage for round-tripping the new fields.

## Non-Goals

- Do not call live LLM providers.
- Do not redesign the entire graph schema.
- Do not implement live external tracker sync.

## Implementation Notes

- Keep the graph canonical and projections derived.
- Prefer a small, typed graph addition over freeform document-only content.
- If schema shape changes require versioning discussion, keep V1 pinned and document the compatibility behavior in the issue result.

## Acceptance Criteria

- `theplanner plan --from <refined-brief> --dry-run --json` includes PRD-grade product metadata in the proposed graph.
- `theplanner plan --apply --json` writes the same metadata to `planning/graph.json`.
- Existing starter and example graphs remain valid or are updated intentionally with tests.
- Missing refined brief sections produce deterministic scaffold notes rather than silent empty output.

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
issues/done/021-add-prd-grade-planning-graph-fields.md
```
