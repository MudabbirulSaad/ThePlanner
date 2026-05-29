# Issue 020: Add Agent Runner Timeouts And Output Limits

## Goal

Bound local agent and validation process execution for production reliability.

## User Story

As a maintainer, I want `planner run` to avoid indefinite hangs and oversized artifacts, so failed local tools do not wedge the planner or fill the workspace.

## Scope

- Add configurable timeout defaults for agent runner and validation command execution.
- Add stdout/stderr capture limits with clear truncation markers in saved artifacts.
- Return structured errors for timeout and output-limit conditions.
- Add tests using fake or local short-lived processes only.
- Document the defaults and config fields.

## Non-Goals

- Do not call live LLM providers.
- Do not implement multi-agent orchestration.
- Do not add sandboxing beyond process timeout/output bounds.

## Acceptance Criteria

- Hung agent and validation commands are terminated after the configured timeout.
- Oversized stdout/stderr is capped deterministically and reported in result JSON.
- Existing successful runner behavior remains compatible.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
```

