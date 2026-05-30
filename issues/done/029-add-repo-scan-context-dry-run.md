# Issue 029: Add Repo Scan Context Dry Run

## Goal

Add a safe, read-only Repo Scan workflow that captures repository context for planning without mutating graph state.

## User Story

As a Primary User, I want the planner to inspect repository structure, commands, existing docs, and architecture clues, so PRD, architecture, and Work Item planning can be grounded in the actual codebase.

## Scope

- Add a dry-run CLI command for scoped Repo Scan output.
- Inspect only safe, local repository metadata and text files needed for planning context.
- Report detected commands, project type, relevant docs, existing planning files, and likely components.
- Keep scan output deterministic and JSON-friendly.
- Add tests using fixtures, not the live user repository.

## Non-Goals

- Do not mutate source code or `planning/graph.json`.
- Do not scan secrets or dump arbitrary file contents.
- Do not call live LLM providers.
- Do not auto-apply scan results to the graph in this issue.

## Implementation Notes

- Repo Scan is already named in the domain glossary; keep it read-only.
- Make file inclusion rules explicit and conservative.
- Future issues can turn scan output into graph operations after this dry-run Interface is stable.

## Acceptance Criteria

- A dry-run command returns deterministic repository context from fixtures.
- The command avoids ignored/heavy directories such as `node_modules`, `dist`, and coverage output.
- Output includes enough context to inform future PRD/architecture planning.
- Tests prove no graph or projection files are written.

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
issues/done/029-add-repo-scan-context-dry-run.md
```
