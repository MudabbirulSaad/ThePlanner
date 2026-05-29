# Issue 012: Add Post-Agent Validation Loop

## Goal

After an agent run, execute the Work Item validation commands and record the result.

## User Story

As a user, I want the planner to verify agent output automatically, so failed runs are visible and not marked complete prematurely.

## Scope

- Extend `planner run` to execute validation commands after the agent process completes.
- Use Work Item validation methods from the graph.
- Capture command output, exit codes, and summary in run artifacts.
- Do not mark Work Items done automatically unless that behavior is explicitly designed and tested.
- Add fake command-runner tests.

## Non-Goals

- Do not auto-commit changes.
- Do not auto-open PRs.
- Do not update external trackers.

## Implementation Notes

- Keep validation execution behind a port for testability.
- Preserve safe failure behavior: do not delete files after failure.
- Make validation failures clear in JSON output.

## Acceptance Criteria

- Successful validation is recorded in run metadata.
- Failed validation produces non-zero command result and saved logs.
- Tests cover pass/fail validation flows.
- Docs explain manual review after agent runs.

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
issues/done/012-post-agent-validation-loop.md
```

