# Issue 045: Make Reconcile Clean After Fresh Export

## Goal

Ensure `export --apply` followed by `reconcile --json` reports no unsupported drift when no human edits have occurred.

## User Story

As a Primary User, I want a freshly exported workspace to reconcile cleanly, so unsupported drift reports only represent real human edits or unsupported changes.

## Scope

- Fix HITL Gate relationship parsing or rendering drift for generated Work Item projections.
- Add a CLI integration test that plans, exports, reconciles, and expects no proposed patches, conflicts, or unsupported projection edits.
- Preserve detection of real unsupported human edits in Work Item projections.
- Keep reconciliation dry-run/apply semantics unchanged.

## Non-Goals

- Do not broaden reconciliation to ingest all HITL Gate edits.
- Do not make Markdown projections canonical.
- Do not suppress genuine unsupported edits just to get a clean report.

## Implementation Notes

- Dogfooding showed `reconcile --json` reporting unsupported `hitl_gates` drift immediately after a clean export.
- The likely issue is a mismatch between rendered projection representation and reconciliation's generated-format parser.
- The regression should use generated artifacts, not a hand-built fixture only.

## Acceptance Criteria

- Fresh `export --apply` followed by `reconcile --json` returns zero `proposedPatches`, zero `conflicts`, and zero `unsupportedProjectionEdits`.
- A deliberately edited unsupported HITL Gate relationship still appears as unsupported or conflict.
- Existing richer Open Question reconciliation behavior remains compatible.

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
issues/done/045-make-reconcile-clean-after-fresh-export.md
```
