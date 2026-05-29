# Issue 014: Add Claude Code And Gemini CLI Runner Stubs

## Goal

Extend the agent runner architecture to support Claude Code and Gemini CLI without forcing full production behavior.

## User Story

As a user, I want the planner to recognize multiple local coding agents, so I can choose the best tool for a Work Item.

## Scope

- Add runner adapter stubs/config for:
  - codex
  - Claude Code
  - Gemini CLI
- Support clear dry-run or missing-binary behavior.
- Add docs showing how to configure each command.
- Add tests using fake runners.

## Non-Goals

- Do not require either CLI to be installed in CI/tests.
- Do not add cloud APIs.
- Do not change the core planning model unless necessary.

## Implementation Notes

- Keep agent-specific process details in adapters.
- Reuse the same `AgentRunner` port.
- Make unsupported features explicit in output.

## Acceptance Criteria

- `--agent claude` and `--agent gemini` are recognized.
- Missing binaries return clear errors.
- Fake-runner tests cover adapter selection.
- Docs describe Codex/Claude/Gemini differences and limitations.

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
issues/done/014-claude-and-gemini-runner-stubs.md
```
