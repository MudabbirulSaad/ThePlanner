# Issue 002: Add Planner Init And Workspace Template

## Goal

Add a first real new-project entrypoint so a user can initialize planning files in a fresh repository without manually creating `planning/graph.json`.

## User Story

As a user with a new software idea, I want to run a command that creates the expected planning workspace structure, so I can start from an empty repo and follow the planner workflow.

## Scope

- Add a `planner init` CLI command.
- Create missing directories:
  - `planning/`
  - `planning/intake/`
  - `planning/work-items/`
  - `planning/execution-slices/`
  - `docs/prd/`
  - `docs/rfc/`
  - `docs/architecture/`
- Create starter files if missing:
  - `planning/intake/idea.md`
  - `planning/change-log.ndjson`
  - `planning/graph.json`
- The starter graph may be empty/minimal, but it must validate or clearly report that planning has not started yet.
- Add JSON and human-readable output.
- Add tests for idempotency: running `init` twice must not destroy existing files.

## Non-Goals

- Do not add live LLM calls.
- Do not generate a full plan from an idea.
- Do not run Codex, Claude Code, or Gemini CLI.
- Do not add external tracker sync.

## Implementation Notes

- Keep core logic pure.
- Put filesystem creation in an adapter/use case boundary.
- The CLI should not prompt unless `--interactive` is passed.
- Prefer deterministic output.

## Acceptance Criteria

- `node dist/src/adapters/cli/index.js init --json` creates the workspace files in a fixture/temp directory.
- Running the command again reports existing files without overwriting user content.
- `npm run check` passes.
- README or docs mention the command.

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
issues/done/002-planner-init-and-workspace-template.md
```

