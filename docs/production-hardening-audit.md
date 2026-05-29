# Production Hardening Audit

Date: 2026-05-29

## Findings

### Medium: projection paths needed workspace confinement

`document_projection.path` values were validated only for presence. Because `export` renders document projections from canonical graph paths, a malformed graph could request projection IO outside the workspace with `..` or absolute path segments.

Status: fixed in this audit. Semantic graph validation now reports `document_projection_unsafe_path`, and filesystem projection IO refuses unsafe relative paths defensively. Regression coverage was added for core validation and filesystem-backed export.

### Medium: JSON error responses are not consistent across commands

Some command failures use structured JSON when `--json` is present, while other argument and service-wiring errors still return plain stderr. This is mostly command UX and automation risk, not data-loss risk.

Status: follow-up issue created as `issues/018-normalize-json-error-responses.md`.

### Medium: schema evolution and migration policy is not explicit

Runtime JSON Schema validation exists, but `schema_version` is not pinned to supported versions and there is no documented migration behavior for future graph versions. Production users need deterministic failure or migration behavior before graph shape changes.

Status: fixed by `issues/done/019-define-schema-version-and-migration-policy.md`. V1 supports only `schema_version: "0.1.0"`; runtime schema validation and core validation reject unsupported versions, and V1 reports migration-unavailable behavior instead of attempting migrations.

### Medium: local runner processes have no timeout or output cap

`planner run` intentionally invokes local agent commands and captures stdout/stderr, but long-running or noisy processes can hang a run or create oversized artifacts. This should be bounded before production use.

Status: fixed by `issues/done/020-add-agent-runner-timeouts-and-output-limits.md`. Local agent processes, Codex auth preflight, and validation commands now have configurable timeouts; stdout and stderr artifacts are capped with deterministic truncation markers and output summaries in run JSON.

## Review Notes

- Command UX: command surface is deterministic and documented. Dry-run/apply split exists for destructive export, plan, reconcile, and sync operations. Remaining concern is inconsistent JSON error output.
- Failure modes: missing graph JSON, schema failures, runner-not-found, auth preflight failure, validation failure, and invalid run IDs have useful handling in covered paths.
- Destructive operations: `init` and refined brief writes preserve existing files unless forced. `plan --apply` refuses non-empty graph overwrite. `export --apply` is intentionally destructive for generated projections and now rejects unsafe projection paths.
- Schema/migration behavior: runtime schema validation happens before semantic validation, and V1 pins supported graphs to `schema_version: "0.1.0"`. Future schema compatibility requires an explicit migration adapter or documented migration-unavailable failure.
- Run artifacts: `prepare --apply` and `run` persist reviewable artifacts under `planning/runs/`; run IDs are validated before review/accept/reject artifact reads.
- Agent process boundaries: live LLM APIs are not called by tests or dry-run paths. `planner run` invokes only the configured local process, with configurable process timeouts and stdout/stderr caps.
- Config loading: `planningDirectory` is validated as a safe relative path; default agent and validation commands are checked. Command strings remain local operator-controlled.
- Docs accuracy: README and demo docs match the current V1 local-first scope. README now documents the V1 schema version and migration-unavailable policy.
- Test coverage: core validation, reconciliation, CLI wiring, config, runner artifacts, schema validation, and dependency boundaries are covered. New coverage was added for unsafe projection paths.
- Security risks: projection path traversal and local runner process bounds are covered in V1. Remaining risks are broader OS-level sandboxing and credential handling for future live integrations.

## Validation Evidence

All required validation commands passed after the hardening fix:

```sh
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
node dist/src/adapters/cli/index.js status --json
node dist/src/adapters/cli/index.js validate --json
node dist/src/adapters/cli/index.js reconcile --json
```

Observed test result: 15 test files passed, 87 tests passed.

## Known Limitations

- Live external tracker sync remains deferred.
- Live LLM provider adapters remain out of scope.
- Autonomous multi-agent orchestration remains out of scope.
- Existing command validation still treats shell operators as requiring an explicit shell wrapper.
