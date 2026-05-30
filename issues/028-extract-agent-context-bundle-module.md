# Issue 028: Extract Agent Context Bundle Module

## Goal

Give agent handoff its own deep module so context selection and rendering can evolve without bloating planner use cases.

## User Story

As a maintainer, I want agent context bundle construction isolated behind a focused interface, so improving agent handoff quality is localized and testable.

## Scope

- Extract agent context selection and rendering from the large planner use-case module.
- Preserve existing `prepare` and `run` CLI behavior.
- Add focused tests for selected context sections, deterministic ordering, validation command rendering, and scope reminders.
- Include dependency view, related PRD/RFC/architecture projections, AGENTS.md, Work Item projection, and readiness details exactly as before unless improved by existing graph data.

## Non-Goals

- Do not change agent execution semantics.
- Do not add multi-agent orchestration.
- Do not introduce new provider-specific prompts beyond existing supported agents.

## Implementation Notes

- This is a deepening/refactor slice: behavior should stay compatible while the module Interface gets clearer.
- Keep application ports for file reads and run artifact writes unchanged unless a small adjustment is necessary.

## Acceptance Criteria

- `theplanner prepare <work-item-id> --agent codex --dry-run --json` still returns a deterministic bundle.
- `theplanner run <work-item-id> --agent codex --json` still writes the same required run artifacts.
- Context bundle tests are no longer coupled to unrelated planner use-case internals.
- Existing integration tests pass without weakening assertions.

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
issues/done/028-extract-agent-context-bundle-module.md
```
