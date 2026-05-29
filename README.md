# AI Engineering Planner

AI Engineering Planner is a CLI-first TypeScript/Node tool for keeping repository planning artifacts aligned with a canonical Planning Graph. It turns planning state into deterministic Markdown projections, dependency views, readiness labels, validation output, and reconciliation reports.

## MVP Scope

The MVP is local and repository-first:

- `planning/graph.json` is the clean starter workspace used by default CLI commands.
- Demo planning state is preserved under `examples/ai-engineering-planner-v1/`.
- In any workspace, the local `planning/graph.json` is the canonical source of truth.
- Markdown files under that workspace's `planning/`, `docs/prd/`, `docs/rfc/`, and `docs/architecture/` paths are projections.
- Work Items carry deterministic execution state, readiness labels, acceptance criteria, and validation methods.
- Validation checks graph semantics and derives readiness summaries.
- Reconciliation inspects Work Item Markdown and proposes safe graph patches without mutating unless `--apply` is passed.
- Planning changes are recorded in `planning/change-log.ndjson` for graph-changing flows.

External tracker sync, live LLM calls, autonomous execution, and full schema-adapter validation are outside V1.

## Setup

Requires Node.js 22 or newer.

```sh
npm install
npm run build
```

The local binary is declared as `planner` and builds to `dist/src/adapters/cli/index.js`.

## Scripts

- `npm run build`: compile TypeScript.
- `npm test`: run Vitest.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run lint`: run ESLint, including dependency-boundary checks.
- `npm run format`: format with Prettier.
- `npm run check`: run build, tests, and lint.
- `npm run validate:graph`: run the built CLI validation command.

## CLI Commands

Use the built CLI directly during development:

```sh
node dist/src/adapters/cli/index.js init --json
node dist/src/adapters/cli/index.js status --json
node dist/src/adapters/cli/index.js validate --json
node dist/src/adapters/cli/index.js export --json
node dist/src/adapters/cli/index.js intake questions --from planning/intake/idea.md --json
node dist/src/adapters/cli/index.js reconcile --json
node dist/src/adapters/cli/index.js reconcile --apply --json
```

Command behavior:

- `init`: creates missing starter directories and files for a planning workspace, including `planning/intake/idea.md`, `planning/change-log.ndjson`, and a minimal valid `planning/graph.json`; existing files are reported and left untouched.
- `status`: returns graph version, validation status, and readiness summary.
- `validate`: returns schema status, semantic errors, semantic warnings, readiness summary, and readiness snapshots.
- `export`: writes deterministic projections from the canonical graph.
- `intake questions --from <file>`: reads a rough intake idea and prints deterministic grilling questions grouped by target user, problem, MVP scope, non-goals, constraints, success criteria, and risks/open questions. Add `--json` for structured output. Paste the human-readable output into Codex, Claude, or Gemini to run a manual grilling conversation before creating a refined brief.
- `reconcile`: reads Work Item projections and reports proposed patches, conflicts, unsupported projection edits, inspected paths, and `applied: false`.
- `reconcile --apply`: applies only safe proposed patches when there are no conflicts, increments graph version, and appends a change-log event.
- `plan --brief <file>`: scaffolded/deferred in V1; it reports command availability but does not build an intake-to-graph planner yet.

Commands do not prompt unless future interactive behavior is explicitly requested with `--interactive`.

## Example Workflow

For a concise walkthrough, see [docs/demo.md](docs/demo.md).

```sh
npm run build
node dist/src/adapters/cli/index.js status --json
node dist/src/adapters/cli/index.js validate --json
node dist/src/adapters/cli/index.js reconcile --json
npm run check
```

The repository root now starts with a minimal starter `planning/graph.json`. The V1 dogfood graph and generated sample projections live in `examples/ai-engineering-planner-v1/`; run the built CLI from that directory to inspect the demo state:

```sh
cd examples/ai-engineering-planner-v1
node ../../dist/src/adapters/cli/index.js status --json
node ../../dist/src/adapters/cli/index.js validate --json
node ../../dist/src/adapters/cli/index.js reconcile --json
```

If `reconcile --json` returns `proposedPatches`, review them before using `--apply`. `unsupportedProjectionEdits` are richer Markdown fields or sections that V1 preserves as manual intent but does not ingest as canonical graph truth. They are not failures by themselves.

## Architecture Boundaries

The repository follows Hexagonal Architecture:

- `src/core/`: pure domain logic for graph types, validation, readiness, projection rendering, and reconciliation.
- `src/application/`: use cases and ports for graph storage, projection IO, CLI orchestration, and change-log writing.
- `src/adapters/`: CLI and filesystem adapter implementations.
- `tests/core/`: domain tests.
- `tests/application/`: use-case tests with fakes.
- `tests/integration/`: CLI and dependency-boundary tests.

`src/core/**` must not import CLI, filesystem, Git, LLM provider, Repo Scan, schema adapter, or other infrastructure code.

## Known V1 Limitations

- `planner plan` is scaffolded and does not yet transform an Intake Brief into a new graph.
- JSON Schema validation is represented by `planning/graph.schema.json`, but the current CLI semantic validator reports `schemaStatus: "not_run"`.
- Reconciliation intentionally treats `planning/graph.json` as canonical. It can propose patches for selected Work Item fields, but richer Markdown sections, decision/component/risk references, and freeform implementation notes are reported as unsupported/deferred.
- External tracker sync is deferred.
- LLM adapters and live provider calls are not implemented.
- No autonomous execution is performed.
