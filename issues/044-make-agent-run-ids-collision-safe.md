# Issue 044: Make Agent Run IDs Collision-Safe

## Goal

Prevent `prepare --apply` and `run` from colliding when they create artifacts for the same Work Item within the same second.

## User Story

As a Primary User, I want repeated prepare/run commands to create unique run directories, so dogfooding or automation cannot fail because a prior run artifact already exists.

## Scope

- Make run id generation collision-safe for both prepared and executed agent runs.
- Preserve deterministic, readable run ids where possible.
- If a generated run directory already exists, allocate a stable suffix rather than overwriting or failing.
- Ensure artifact writers still refuse accidental overwrite of individual files inside an existing run directory.
- Add integration coverage for `prepare --apply` followed immediately by `run` for the same Work Item.

## Non-Goals

- Do not delete or mutate existing run artifacts.
- Do not make run artifacts ignored by Git.
- Do not change the metadata contract except for the run id value when a suffix is needed.

## Implementation Notes

- Dogfooding reproduced `EEXIST` when `prepare --apply` and `run` both generated `run-YYYYMMDD-HHMMSS-wi-101`.
- The fix should live in application/use-case or filesystem artifact allocation logic, not in the core domain.
- Keep JSON output explicit about the final run id and created paths.

## Acceptance Criteria

- `prepare <work-item> --apply --json` followed by `run <work-item> --agent codex --json` in the same second succeeds when the Work Item is AFK-ready.
- The second command receives a distinct run id and writes a distinct artifact directory.
- Existing run artifact files are never overwritten silently.
- Regression tests cover the collision path.

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
issues/done/044-make-agent-run-ids-collision-safe.md
```
