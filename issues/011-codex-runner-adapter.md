# Issue 011: Add Codex Runner Adapter

## Goal

Add the first real coding-agent execution adapter, starting with Codex only.

## User Story

As a user, I want to run a ready Work Item through Codex from the planner, so planning and implementation can connect in one local workflow.

## Scope

- Define an `AgentRunner` port.
- Add a Codex adapter behind that port.
- Add a command such as:

```sh
planner run wi-009 --agent codex --json
```

- The command should:
  - verify readiness
  - create/load an agent context bundle
  - invoke Codex through a configurable command
  - capture exit code
  - save logs under `planning/runs/`
- Add tests with a fake runner. Do not require Codex to be installed in tests.

## Non-Goals

- Do not implement Claude Code or Gemini CLI yet.
- Do not make autonomous decisions beyond the selected Work Item.
- Do not skip validation.

## Implementation Notes

- Make the actual command configurable.
- Treat missing Codex binary as a clear runtime error.
- Keep unit tests fake/process-free where possible.

## Acceptance Criteria

- The application can run through a fake Codex runner in tests.
- Missing/failed runner produces useful JSON.
- Run logs/artifacts are persisted.
- Docs explain setup and risks.

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
issues/done/011-codex-runner-adapter.md
```

