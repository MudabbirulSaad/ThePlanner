# Issue 015: Add Production Packaging And Config

## Goal

Prepare the CLI for real local installation and configurable workspace behavior.

## User Story

As a user, I want to install and run `planner` directly with project config, so I do not need `node dist/...` commands.

## Scope

- Add or verify bin packaging for `planner`.
- Add a config file such as:

```text
planner.config.json
```

- Config should support:
  - planning directory
  - default agent
  - agent command paths
  - validation command defaults
- Add docs for local/global usage.
- Add tests for config loading and defaults.

## Non-Goals

- Do not publish to npm in this issue unless explicitly requested.
- Do not add telemetry.
- Do not add external tracker sync.

## Implementation Notes

- Keep config parsing deterministic and validated.
- Make default behavior match the current repo layout.

## Acceptance Criteria

- `planner` can be run through npm bin/local package workflow.
- Config defaults preserve existing behavior.
- Invalid config returns useful errors.
- README setup commands are updated.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
npm pack --dry-run
```

## Completion

When complete, move this file to:

```text
issues/done/015-production-packaging-and-config.md
```

