# Issue 006: Add Plan From Brief Apply And Change Log

## Goal

Allow a user to apply a graph proposal from a refined brief and record the graph creation event.

## User Story

As a user, I want to turn a refined brief into `planning/graph.json`, so I can validate/export Work Items and start implementation.

## Scope

- Extend `planner plan --from <brief>` with `--apply`.
- Write `planning/graph.json` only when explicitly applying.
- Append a `planning/change-log.ndjson` event describing graph creation/update.
- Refuse to overwrite an existing non-empty graph unless a safe update path exists or a future explicit force flag is added.
- Add tests for:
  - apply creates graph
  - change-log event is written
  - existing graph is protected

## Non-Goals

- Do not add LLM calls.
- Do not modify source code outside planning artifacts.
- Do not run agents.

## Implementation Notes

- Validate the proposed graph before writing.
- Use graph versioning consistently.
- Keep event fields coherent with existing change-log conventions.

## Acceptance Criteria

- `planner plan --from planning/intake/refined-brief.md --apply --json` writes a valid graph in a fixture/temp workspace.
- The change log records the operation.
- Existing graph protection has test coverage.
- `planner validate --json` passes on the created graph.

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
issues/done/006-plan-from-brief-apply-and-change-log.md
```

