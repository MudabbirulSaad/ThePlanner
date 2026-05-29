# Issue 010: Persist Agent Run Artifacts

## Goal

Create a durable local record for agent handoff attempts before implementing actual background execution.

## User Story

As a user, I want each prepared agent run to have saved context and metadata, so I can inspect what was handed to an agent and reproduce the session.

## Scope

- Add a run artifact structure such as:

```text
planning/runs/run-YYYYMMDD-HHMMSS-<work-item-id>/
  metadata.json
  prompt.md
  context.md
```

- Extend `planner prepare` with an apply/write mode if needed.
- Record:
  - run id
  - Work Item id
  - graph version
  - selected agent
  - generated timestamp
  - validation commands
- Add tests with deterministic timestamp injection.

## Non-Goals

- Do not execute external agent CLIs.
- Do not add process management.
- Do not add external storage.

## Implementation Notes

- Keep run artifacts local and git-reviewable.
- Avoid nondeterminism in tests.
- Consider whether run artifacts should be ignored or committed; document the decision.

## Acceptance Criteria

- A prepare/write command creates run artifacts.
- JSON output reports created paths.
- Tests verify deterministic metadata.
- Docs explain how run artifacts support manual agent execution.

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
issues/done/010-persist-agent-run-artifacts.md
```

