# Issue 009: Add Agent Context Bundle Dry Run

## Goal

Create the bridge between planning and coding agents without executing any agent yet.

## User Story

As a user, I want the planner to prepare a complete context bundle for one Work Item, so I can paste it into Codex, Claude Code, or Gemini CLI reliably.

## Scope

- Add a command such as:

```sh
planner prepare wi-009 --agent codex --dry-run --json
```

- Verify the Work Item exists and is agent-eligible or explain why not.
- Collect context:
  - `AGENTS.md`
  - selected Work Item projection
  - `planning/dependencies.md`
  - related docs from graph relationships where available
  - validation commands
  - non-goals/scope reminder
- Output a prompt/context bundle path or the generated content in dry-run mode.
- Add fixture-based tests.

## Non-Goals

- Do not run Codex, Claude Code, or Gemini CLI.
- Do not mutate source code.
- Do not mark Work Items done.

## Implementation Notes

- This is the most important bridge before background agent execution.
- Prefer deterministic context ordering.
- Make unsupported agents report a clear error or documented scaffold behavior.

## Acceptance Criteria

- Preparing a valid Work Item returns a deterministic context bundle.
- Preparing a missing or blocked Work Item returns a useful error.
- Dry-run does not write run artifacts unless explicitly designed and documented.
- Docs show how to paste the bundle into an agent manually.

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
issues/done/009-agent-context-bundle-dry-run.md
```

