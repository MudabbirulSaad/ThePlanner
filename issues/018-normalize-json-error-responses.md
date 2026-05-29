# Issue 018: Normalize JSON Error Responses

## Goal

Make every CLI failure return structured JSON when `--json` is present.

## User Story

As an automation user, I want consistent JSON error envelopes, so scripts do not need per-command stderr parsing.

## Scope

- Audit all `runPlannerCli` error return paths.
- Route `--json` failures through a common structured error renderer.
- Preserve current human-readable stderr behavior when `--json` is absent.
- Add focused CLI tests for argument errors and service-wiring errors.

## Non-Goals

- Do not change successful command output shapes.
- Do not add new commands.
- Do not change exit code semantics except where needed to preserve failure status.

## Acceptance Criteria

- Known argument errors return `{ "status": "failed", "error": { "message": "..." } }` on stdout with empty stderr when `--json` is present.
- Non-JSON failures remain concise stderr messages.
- Existing tests pass.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
```

