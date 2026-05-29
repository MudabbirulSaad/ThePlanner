# Issue 001: Clean Repository Sample Planning Artifacts

## Goal

Separate the product source code from the demo/sample planning workspace so the repository is clean before building the next production slices.

## User Story

As a maintainer, I want demo planning artifacts separated from the product implementation, so a fresh user can start with `planner init` instead of inheriting the MVP demo graph.

## Scope

- Review current sample/demo artifacts:
  - `planning/graph.json`
  - `planning/change-log.ndjson`
  - `planning/dependencies.md`
  - `planning/work-items/*.md`
  - `planning/execution-slices/*.md`
  - `docs/prd/ai-engineering-planner-v1.md`
  - `docs/rfc/ai-engineering-planner-v1.md`
  - `docs/architecture/ai-engineering-planner-v1.md`
- Decide and implement one clean structure:
  - move demo artifacts under an example path such as `examples/ai-engineering-planner-v1/`, or
  - keep only the minimal files required for current validation and document them as sample state.
- Update commands/docs/tests so the repository still validates after the cleanup.
- Preserve useful demo artifacts; do not delete them unless they are regenerated elsewhere or explicitly obsolete.

## Non-Goals

- Do not add new product features.
- Do not implement `planner init`.
- Do not redesign the graph model.
- Do not remove tests or validation just to make cleanup easier.

## Implementation Notes

- Current `npm run validate:graph` expects a root `planning/graph.json`.
- If demo artifacts move to `examples/`, either update validation defaults carefully or keep a minimal root planning graph until `planner init` exists.
- Prefer a reversible move over deletion.
- Keep README/demo docs accurate after the cleanup.

## Acceptance Criteria

- The repo structure makes it clear which files are product source and which files are demo/sample planning state.
- No duplicate or stale Work Item projection files remain.
- `npm run check` passes.
- `npm run validate:graph` either passes or has an intentionally updated, documented target.
- README explains how to start after cleanup.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
node dist/src/adapters/cli/index.js reconcile --json
```

## Completion

When complete, move this file to:

```text
issues/done/001-clean-repository-sample-planning-artifacts.md
```

