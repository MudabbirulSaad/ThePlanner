# Issue 005: Add Plan From Brief Dry Run

## Goal

Add the first intake-to-graph planning command in dry-run mode only.

## User Story

As a user with a refined brief, I want to preview a proposed Planning Graph before it writes to the repository.

## Scope

- Add or complete a command such as:

```sh
planner plan --from planning/intake/refined-brief.md --dry-run --json
```

- Parse the refined brief into a deterministic graph proposal.
- The proposal can be conservative and scaffolded, but it should include:
  - requirements
  - open questions
  - risks
  - components if obvious from the brief
  - execution slices
  - Work Items
  - document projection nodes
- Dry-run must not mutate the worktree.
- Add tests with fixture refined briefs.

## Non-Goals

- Do not write `planning/graph.json`.
- Do not export projections.
- Do not call LLMs.
- Do not run coding agents.

## Implementation Notes

- Be honest in output if fields are scaffolded.
- Prefer a small valid graph over an ambitious invalid graph.
- Keep deterministic IDs stable for fixture inputs.

## Acceptance Criteria

- Dry-run prints a valid graph proposal as JSON.
- The command exits non-zero for missing/empty brief files.
- Tests prove no files are written in dry-run.
- Documentation explains dry-run before apply.

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
issues/done/005-plan-from-brief-dry-run.md
```

