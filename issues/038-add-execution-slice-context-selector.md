# Issue 038: Add Execution Slice Context Selector

## Goal

Compact agent handoff context to the selected Work Item, its active Execution Slice, and immediate Dependency Edges.

## User Story

As a Primary User, I want coding agents to receive only the context needed for the active execution slice, so they stay in bounds and avoid context degradation.

## Scope

- Add a context selector that starts from a Work Item and includes its Execution Slice when present.
- Include immediate Dependency Edges and directly referenced Requirements, Decisions, Components, Risks, Open Questions, and HITL Gates.
- Route existing `prepare` and `run` context bundle construction through the selector.
- Preserve AGENTS.md, validation commands, scope reminders, and safe-failure guidance.
- Add tests proving unrelated PRD/architecture content is omitted while necessary dependency context remains.

## Non-Goals

- Do not change agent execution semantics.
- Do not add provider-specific context formats.
- Do not remove required local instruction files such as AGENTS.md.
- Do not implement reviewer LLM behavior.

## Implementation Notes

- Keep the selector in the application layer unless it becomes pure graph selection with no IO.
- Make ordering deterministic for golden tests.
- Existing agent-context-bundle tests should become more precise rather than weaker.

## Acceptance Criteria

- `prepare --dry-run` still returns a valid agent context bundle.
- The bundle includes only the selected Work Item, active slice context, immediate dependencies, validation commands, and required local instructions.
- Tests prove unrelated document projection content is not included by default.
- Existing `run` behavior remains compatible.

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
issues/done/038-add-execution-slice-context-selector.md
```
