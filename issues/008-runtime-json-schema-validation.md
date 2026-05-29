# Issue 008: Add Runtime JSON Schema Validation

## Goal

Make `schemaStatus` real by validating `planning/graph.json` against `planning/graph.schema.json`.

## User Story

As a user, I want validation to catch malformed graph JSON before semantic validation, so graph corruption is reported clearly.

## Scope

- Add a schema validation port/use case or adapter consistent with the architecture.
- Wire `planner validate --json` so `schemaStatus` is no longer always `not_run`.
- Report schema errors separately from semantic errors.
- Add tests for:
  - valid graph schema passes
  - malformed JSON shape fails schema validation
  - semantic validation still runs or is skipped according to a documented rule

## Non-Goals

- Do not redesign the graph schema.
- Do not add migrations in this issue.
- Do not add external services.

## Implementation Notes

- Use an existing JSON Schema validator dependency only if already present or add a minimal dependency deliberately.
- Keep errors readable.
- Do not let schema validation import adapters into core.

## Acceptance Criteria

- `planner validate --json` reports `schemaStatus: "pass"` for the current graph.
- Schema failures produce useful JSON output and non-zero exit code.
- Tests cover schema pass/fail cases.
- README and demo docs are updated if output shape changes.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
```

## Completion

When complete, move this file to:

```text
issues/done/008-runtime-json-schema-validation.md
```

