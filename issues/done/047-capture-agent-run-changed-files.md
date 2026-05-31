# Issue 047: Capture Agent Run Changed Files

## Goal

Record changed files from local agent execution so `run review` can show what the agent actually modified.

## User Story

As a Primary User, I want `run review` to list changed files from the agent run, so I can review execution impact before accepting, rejecting, or applying reviewer graph operations.

## Scope

- Capture a deterministic changed-file summary for `theplanner run`.
- Include created, modified, and deleted files where the repository context can provide them.
- Persist the changed-file summary in `result.json`.
- Surface the summary in `run review --json`.
- Add integration coverage with a fake agent that writes a file and a validation command that passes.

## Non-Goals

- Do not auto-commit agent changes.
- Do not require Git for non-Git workspaces unless the implementation has a fallback.
- Do not include full file contents in the changed-file summary.
- Do not mark Work Items done based only on changed files.

## Implementation Notes

- Dogfooding showed `changedFiles: []` even though the fake agent wrote `src/features/todo-workflow.md`.
- Prefer a Git adapter when `.git` is available and a conservative filesystem snapshot fallback for temp/non-Git workspaces if practical.
- Keep this in adapters/application ports; core should not import Git or filesystem scanning.

## Acceptance Criteria

- A fake agent run that creates a file records that file in `result.json`.
- `run review --json` surfaces the same changed-file summary.
- Existing run artifact behavior remains compatible.
- Tests cover at least created files and one no-change run.

## Blocked by

- Issue 039: Add Reviewer Graph Operation Hook

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
issues/done/047-capture-agent-run-changed-files.md
```
