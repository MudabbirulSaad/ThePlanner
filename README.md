# AI Engineering Planner

AI Engineering Planner is a CLI-first TypeScript/Node tool for keeping repository planning artifacts aligned with a canonical Planning Graph. It turns planning state into deterministic Markdown projections, dependency views, readiness labels, validation output, and reconciliation reports.

## MVP Scope

The MVP is local and repository-first:

- `planning/graph.json` is the clean starter workspace used by default CLI commands.
- Demo planning state is preserved under `examples/ai-engineering-planner-v1/`.
- In any workspace, the local `planning/graph.json` is the canonical source of truth.
- Markdown files under that workspace's `planning/`, `docs/prd/`, `docs/rfc/`, and `docs/architecture/` paths are projections.
- Work Items carry deterministic execution state, readiness labels, acceptance criteria, and validation methods.
- Validation checks graph JSON Schema shape, graph semantics, and derived readiness summaries.
- Reconciliation inspects Work Item Markdown and proposes safe graph patches without mutating unless `--apply` is passed.
- Planning changes are recorded in `planning/change-log.ndjson` for graph-changing flows.

External tracker sync, live LLM calls, and autonomous execution are outside V1.

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
node dist/src/adapters/cli/index.js export --dry-run --json
node dist/src/adapters/cli/index.js export --apply --json
node dist/src/adapters/cli/index.js intake questions --from planning/intake/idea.md --json
node dist/src/adapters/cli/index.js intake refine --from planning/intake/idea.md --out planning/intake/refined-brief.md --json
node dist/src/adapters/cli/index.js plan --from planning/intake/refined-brief.md --dry-run --json
node dist/src/adapters/cli/index.js plan --from planning/intake/refined-brief.md --apply --json
node dist/src/adapters/cli/index.js reconcile --json
node dist/src/adapters/cli/index.js reconcile --apply --json
node dist/src/adapters/cli/index.js prepare wi-001 --agent codex --dry-run --json
node dist/src/adapters/cli/index.js prepare wi-001 --agent codex --apply --json
node dist/src/adapters/cli/index.js run wi-001 --agent codex --json
node dist/src/adapters/cli/index.js run wi-001 --agent claude --json
node dist/src/adapters/cli/index.js run wi-001 --agent gemini --json
node dist/src/adapters/cli/index.js run review run-YYYYMMDD-HHMMSS-wi-001 --json
node dist/src/adapters/cli/index.js run accept run-YYYYMMDD-HHMMSS-wi-001 --json
node dist/src/adapters/cli/index.js run reject run-YYYYMMDD-HHMMSS-wi-001 --json
```

Command behavior:

- `init`: creates missing starter directories and files for a planning workspace, including `planning/intake/idea.md`, `planning/change-log.ndjson`, `planning/graph.schema.json`, and a minimal valid `planning/graph.json`; existing files are reported and left untouched.
- `status`: returns graph version, validation status, and readiness summary.
- `validate`: validates `planning/graph.json` against `planning/graph.schema.json`, then returns schema status, schema errors, semantic errors, semantic warnings, readiness summary, and readiness snapshots. Semantic validation is skipped when schema validation fails.
- `export --dry-run --json`: previews deterministic projection writes from the canonical graph without changing files. JSON reports files that would be created, updated, unchanged, and Markdown sections that may contain human-authored notes an apply would overwrite.
- `export --apply --json`: writes deterministic projections from the canonical graph. Projection files are generated artifacts; applying export overwrites the full rendered file content. Bare `export` is retained as a compatibility alias for apply.
- `intake questions --from <file>`: reads a rough intake idea and prints deterministic grilling questions grouped by target user, problem, MVP scope, non-goals, constraints, success criteria, and risks/open questions. Add `--json` for structured output. Paste the human-readable output into Codex, Claude, or Gemini to run a manual grilling conversation before creating a refined brief.
- `intake refine --from <file> --out <file>`: creates a user-owned refined brief Markdown scaffold with TODO sections for product summary, users, goals, MVP scope, non-goals, constraints, success criteria, and open questions. Existing files are reported as skipped and left untouched unless `--force` is passed. Fill this brief manually or with an agent before planning from it.
- `plan --from <file> --dry-run --json`: reads a refined brief and prints a deterministic valid graph proposal without writing `planning/graph.json` or exporting projections. The proposal is conservative and includes scaffold notes where fields are inferred.
- `plan --from <file> --apply --json`: validates the refined brief graph proposal, writes `planning/graph.json`, and appends `planning/change-log.ndjson`. Existing non-empty graphs are protected until a future explicit update or force path exists.
- `reconcile`: reads Work Item projections and reports proposed patches, conflicts, unsupported projection edits, inspected paths, and `applied: false`.
- `reconcile --apply`: applies only safe proposed patches when there are no conflicts, increments graph version, and appends a change-log event.
- `prepare <work-item-id> --agent <codex|claude|gemini> --dry-run --json`: verifies the Work Item exists and is agent-eligible, then prints a deterministic manual paste context bundle with `AGENTS.md`, the rendered Work Item projection, dependency view, related document projections, validation commands, and scope reminders. Dry run does not execute agents, write run artifacts, mutate source code, or mark Work Items done.
- `prepare <work-item-id> --agent <codex|claude|gemini> --apply --json`: writes a local handoff record under `planning/runs/run-YYYYMMDD-HHMMSS-<work-item-id>/` with `metadata.json`, `prompt.md`, and `context.md`. JSON reports the run id, metadata, and created paths. These run artifacts are not ignored by default because they are local, git-reviewable evidence of what was handed to an agent. Use `prompt.md` as the manual paste prompt and `context.md` to inspect or reproduce the exact context bundle. Apply mode does not execute an agent, mutate graph state, or mark Work Items done.
- `run <work-item-id> --agent <codex|claude|gemini> --json`: verifies the Work Item is agent-eligible and AFK-ready, creates the same context bundle, invokes the selected local coding-agent CLI, then runs the Work Item validation commands. It writes `metadata.json`, `prompt.md`, `context.md`, `runner-stdout.log`, `runner-stderr.log`, `validation-stdout.log`, `validation-stderr.log`, and `result.json` under `planning/runs/run-YYYYMMDD-HHMMSS-<work-item-id>/`. Missing binaries return failed JSON with `runner.error.code: runner_not_found`; Codex auth preflight failures return `runner.error.code: runner_auth_failed`; validation failures return failed JSON with `validation.status: "fail"`. Running a coding agent may modify your working tree; review the saved run artifacts and working tree before accepting any changes.
- `run review <run-id> --json`: reads saved `metadata.json` and `result.json` from `planning/runs/<run-id>/` and summarizes the Work Item, agent exit code, validation results, changed files when present in the run result, and artifact paths.
- `run accept <run-id> --json` / `run reject <run-id> --json`: appends an audit event to `planning/change-log.ndjson` for the human decision. These commands do not change Work Item state, commit files, or delete run artifacts.

Commands do not prompt unless future interactive behavior is explicitly requested with `--interactive`.

## Agent Runner Commands

`planner run` is a local process runner only. It sends the generated prompt to the selected command on stdin and sets `PLANNER_AGENT`, `PLANNER_RUN_ID`, `PLANNER_WORK_ITEM_ID`, and `PLANNER_RUN_DIRECTORY` in the child process environment.

Default commands:

- Codex: `codex exec -`, configured with `PLANNER_CODEX_COMMAND`.
- Claude Code: `claude`, configured with `PLANNER_CLAUDE_COMMAND`.
- Gemini CLI: `gemini`, configured with `PLANNER_GEMINI_COMMAND`.

Codex runs a local auth preflight with `codex login status` before the agent command when the configured binary is named `codex`. Run `codex login` yourself if the preflight reports `runner_auth_failed`. The default Codex command uses `exec -` so the generated prompt is read from stdin non-interactively.

`--runner-command "<command>"` overrides the configured command for the selected run. Use this for wrappers or local test scripts, for example `--runner-command "node scripts/fake-agent.js"`. Claude Code and Gemini CLI support is intentionally a runner stub: planner selects and invokes the local command, captures stdout/stderr, records artifacts, and reports missing binaries clearly, but it does not manage provider auth, cloud APIs, multi-agent coordination, or agent-specific feature flags. Claude/Gemini auth preflights are deferred until their local status commands are pinned.

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

- `planner plan` supports dry-run JSON proposals and explicit new-graph creation with `--apply`; updates to existing non-empty graphs and force overwrite flows are deferred.
- Runtime JSON Schema validation covers the current `planning/graph.schema.json` keyword set before semantic validation. Broader schema evolution and migrations are deferred.
- Reconciliation intentionally treats `planning/graph.json` as canonical. It can propose patches for selected Work Item fields, but richer Markdown sections, decision/component/risk references, and freeform implementation notes are reported as unsupported/deferred.
- External tracker sync is deferred.
- LLM cloud API adapters and live provider calls are not implemented.
- `planner run` executes only one selected local CLI agent for one Work Item and then runs the Work Item validation commands. Multi-agent orchestration, automatic Work Item state changes, and autonomous acceptance/rejection remain deferred.
- Validation commands are executed directly as argv-style process commands. Shell operators such as `&&` require an explicit shell command wrapper.
