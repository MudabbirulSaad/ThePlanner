# ThePlanner

ThePlanner is a CLI-first TypeScript/Node tool for turning a product idea into repository-native planning artifacts backed by a canonical Planning Graph. It produces deterministic PRD, architecture, RFC, dependency, Work Item, readiness, agent-context, validation, run-audit, tracker-preview, repo-scan, and reconciliation outputs.

## At a Glance

| | |
| --- | --- |
| **Problem** | Product intent is often scattered across prose, tickets, and agent prompts with no reliable dependency or readiness model. |
| **Approach** | Keep one validated Planning Graph as the source of truth and generate deterministic, reviewable repository artifacts from it. |
| **Release** | `0.1.1`, published as [`@mudabbirulsaad/theplanner`](https://www.npmjs.com/package/@mudabbirulsaad/theplanner). |
| **Quality** | Strict TypeScript, hexagonal boundaries, schema and semantic validation, Vitest coverage, golden files, and CLI integration tests. |

## Quick Demonstration

```sh
npx @mudabbirulsaad/theplanner init --json
npx @mudabbirulsaad/theplanner status --json
npx @mudabbirulsaad/theplanner validate --json
```

The commands create or inspect a local planning workspace without requiring a hosted service. Mutating operations distinguish preview from apply, and generated artifacts remain reviewable in Git.

## Engineering Evidence

- A pure domain core owns graph semantics, readiness, projection rendering, and reconciliation.
- Application ports isolate filesystem, process, tracker, schema, and future LLM-provider adapters.
- Agent execution is bounded, auditable, and human-reviewed through saved run artifacts and explicit accept/reject events.
- `npm run check` compiles the project, runs tests, and enforces dependency boundaries.

## MVP Scope

The MVP is local and repository-first:

- `planning/graph.json` is the clean starter workspace used by default CLI commands.
- Demo planning state is preserved under `examples/ai-engineering-planner-v1/`.
- In any workspace, the local `planning/graph.json` is the canonical source of truth.
- Markdown files under that workspace's `planning/`, `docs/prd/`, `docs/rfc/`, and `docs/architecture/` paths are projections.
- Work Items carry deterministic execution state, readiness labels, acceptance criteria, and validation methods.
- Validation checks graph JSON Schema shape, graph semantics, and derived readiness summaries.
- Reconciliation inspects Work Item Markdown plus supported PRD and architecture Open Question edits, then proposes safe graph patches without mutating unless `--apply` is passed.
- Planning changes are recorded in `planning/change-log.ndjson` for graph-changing flows.

External tracker live sync and live LLM cloud API calls are outside V1. Local agent execution is supported through configured CLI commands and remains human-reviewed through saved run artifacts plus accept/reject audit events.

## Current Release

Version `0.1.1` adds the dogfooded planning loop for product-grade artifacts and local agent handoff:

- PRD-grade `product_intent` graph metadata from refined briefs.
- Rich PRD projection rendering for product summary, users, goals, MVP scope, requirements, assumptions, open questions, risks, success criteria, and traceability.
- Architecture-grade component interfaces, dependencies, constraints, risks, validation, and architecture projection rendering.
- RFC decision extraction and rendering for accepted, proposed, and revisit decisions.
- HITL gates derived from blocking assumptions, high-impact risks, unresolved decisions, and execution-blocking open questions.
- Deeper AFK readiness checks for context, boundaries, validation strength, dependency closure, and safe-failure guidance.
- Extracted agent context bundle rendering and persisted run handoff artifacts.
- Read-only `scan repo --dry-run` context discovery.
- Reconciliation for deterministic Open Question edits in PRD and architecture projections.

## Strategic Roadmap

The next architecture direction is the Graph Operation pipeline. ThePlanner will integrate Codex, Claude, Gemini, and other LLM-backed proposal sources without allowing them to write canonical planning state directly.

Architecture references:

- [ADR 0004: Graph Operation Pipeline for LLM Adapters](docs/adr/0004-graph-operation-pipeline-for-llm-adapters.md)
- [RFC: Graph Operation LLM Pipeline](docs/rfc/graph-operation-llm-pipeline.md)
- [Proposed Graph Operation Contract](docs/proposed-graph-operation-contract.md)

Core rule:

- LLMs are proposal engines only.
- LLM adapters must not write `planning/graph.json`, `planning/graph.schema.json`, Markdown projections, run audit files, or `planning/change-log.ndjson` directly.
- LLM adapters return structured `ProposedGraphOperation` objects such as `AddOpenQuestion`, `AddRequirement`, `AddDecision`, `AddWorkItem`, `AddDependencyEdge`, `AddHitlGate`, or `UpdateWorkItemExecutionState`.
- Core graph-operation logic applies proposals to a candidate graph deterministically.
- JSON Schema validation and semantic Graph Validation must pass before any canonical graph mutation.
- Commitment-changing, scope-changing, risk-changing, readiness-changing, or safety-relevant operations require Graph Operation Approval before apply.
- Only validated and approved operations can increment graph version, save `planning/graph.json`, append `planning/change-log.ndjson`, and trigger projection regeneration.

Three-phase roadmap:

- Phase 1, Control Layer: add `src/core/graph-operations.ts` for operation types, deterministic candidate-graph application, provenance, approval classification, and strict rejection of untestable LLM-proposed Work Items.
- Phase 2, Grilling Interface: add the application-layer `GraphOperationProposer` port. LLMs that lack context should propose `AddOpenQuestion` operations; user answers then feed back as proposed requirements, decisions, assumptions, risks, or HITL gates.
- Phase 3, Real LLM Integration and Autonomous Review: implement provider adapters under `src/adapters/llm/`, compact execution context to the active Execution Slice plus immediate Dependency Edges, and add a reviewer LLM hook that proposes graph operations from run results and validation output.

Strict LLM Work Item rule:

- An LLM-proposed Work Item must include Acceptance Criteria.
- It must include at least one executable command or test Validation Method.
- It must include context summary, boundary notes, traceability, and safe-failure guidance before it can become canonical.
- Missing testability is a validation failure, not a warning.

## Setup

Requires Node.js 22 or newer.

Install the published CLI:

```sh
npm install --global @mudabbirulsaad/theplanner
theplanner init --json
theplanner status --json
```

Run without installing globally:

```sh
npx @mudabbirulsaad/theplanner status --json
```

For local development from this repository:

```sh
npm install
npm run build
```

The published binary is declared as `theplanner` and builds to `dist/src/adapters/cli/index.js`. During local development, run the built entry point directly:

```sh
node dist/src/adapters/cli/index.js status --json
node dist/src/adapters/cli/index.js validate --json
```

For a global local install without publishing to npm:

```sh
npm install --global .
theplanner status --json
```

Project defaults are read from `planner.config.json` when present. The default config preserves the repository layout:

```json
{
  "planningDirectory": "planning",
  "defaultAgent": "codex",
  "agentCommands": {
    "codex": "codex exec -",
    "claude": "claude",
    "gemini": "gemini"
  },
  "validationCommands": [],
  "agentRunnerTimeoutMs": 1800000,
  "validationCommandTimeoutMs": 600000,
  "processOutputLimitBytes": 1048576
}
```

Use `--config <file>` to load a different config file. `planningDirectory` remaps planner-owned `planning/` paths, `defaultAgent` is used when `prepare` or `run` omits `--agent`, `agentCommands` configures local agent binaries, and `validationCommands` are fallback commands for Work Items without command validation methods. `agentRunnerTimeoutMs` bounds the selected local agent process and its auth preflight, `validationCommandTimeoutMs` bounds each validation command, and `processOutputLimitBytes` caps each stdout and stderr artifact stream before a deterministic truncation marker is appended.

## Scripts

- `npm run build`: compile TypeScript.
- `npm run prepack`: build before packing the npm tarball.
- `npm run prepublishOnly`: run the full check before npm publish.
- `npm test`: run Vitest.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run lint`: run ESLint, including dependency-boundary checks.
- `npm run format`: format with Prettier.
- `npm run check`: run build, tests, and lint.
- `npm run validate:graph`: run the built CLI validation command.

## CLI Commands

Use the installed package binary:

```sh
theplanner init --json
theplanner status --json
theplanner validate --json
theplanner export --dry-run --json
theplanner export --apply --json
theplanner intake questions --from planning/intake/idea.md --json
theplanner intake refine --from planning/intake/idea.md --out planning/intake/refined-brief.md --json
theplanner plan --from planning/intake/refined-brief.md --dry-run --json
theplanner plan --from planning/intake/refined-brief.md --apply --json
theplanner scan repo --dry-run --json
theplanner reconcile --json
theplanner reconcile --apply --json
theplanner prepare wi-001 --agent codex --dry-run --json
theplanner prepare wi-001 --agent codex --apply --json
theplanner run wi-001 --agent codex --json
theplanner run wi-001 --agent claude --json
theplanner run wi-001 --agent gemini --json
theplanner run review run-YYYYMMDD-HHMMSS-wi-001 --json
theplanner run accept run-YYYYMMDD-HHMMSS-wi-001 --json
theplanner run reject run-YYYYMMDD-HHMMSS-wi-001 --json
theplanner sync github --dry-run --json
```

Command behavior:

- `init`: creates missing starter directories and files for a planning workspace, including `planning/intake/idea.md`, `planning/change-log.ndjson`, `planning/graph.schema.json`, and a minimal valid `planning/graph.json`; existing files are reported and left untouched.
- `status`: returns graph version, validation status, and readiness summary.
- `validate`: validates `planning/graph.json` against `planning/graph.schema.json`, then returns schema status, schema errors, semantic errors, semantic warnings, readiness summary, and readiness snapshots. Semantic validation is skipped when schema validation fails.
- `export --dry-run --json`: previews deterministic projection writes from the canonical graph without changing files. JSON reports files that would be created, updated, unchanged, and Markdown sections that may contain human-authored notes an apply would overwrite. PRD projections render reviewable product-planning sections, including product summary, target users, goals, non-goals, requirements, success criteria, assumptions, open questions, risks, and Work Item traceability.
- `export --apply --json`: writes deterministic projections from the canonical graph. Projection files are generated artifacts; applying export overwrites the full rendered file content. Bare `export` is retained as a compatibility alias for apply.
- `intake questions --from <file>`: reads a rough intake idea and prints deterministic grilling questions grouped by target user, problem, MVP scope, non-goals, constraints, success criteria, and risks/open questions. Add `--json` for structured output. Paste the human-readable output into Codex, Claude, or Gemini to run a manual grilling conversation before creating a refined brief.
- `intake refine --from <file> --out <file>`: creates a user-owned refined brief Markdown scaffold with TODO sections for product summary, users, goals, MVP scope, non-goals, constraints, success criteria, and open questions. Existing files are reported as skipped and left untouched unless `--force` is passed. Fill this brief manually or with an agent before planning from it.
- `plan --from <file> --dry-run --json`: reads a refined brief and prints a deterministic valid graph proposal without writing `planning/graph.json` or exporting projections. The proposal is conservative and includes scaffold notes where fields are inferred.
- `plan --from <file> --apply --json`: validates the refined brief graph proposal, writes `planning/graph.json`, and appends `planning/change-log.ndjson`. Existing non-empty graphs are protected until a future explicit update or force path exists.
- `scan repo --dry-run --json`: scans deterministic local repository context, including package scripts, project types, relevant docs/headings, planning files, source areas, ignored directories, and scanned files. It is read-only and never writes planning files.
- `reconcile`: reads document and Work Item projections and reports proposed patches, conflicts, unsupported projection edits, inspected paths, and `applied: false`.
- `reconcile --apply`: applies only safe proposed patches when there are no conflicts, increments graph version, and appends a change-log event. Current richer document reconciliation supports deterministic Open Question question and `blocks_execution` edits in PRD and architecture projections.
- `prepare <work-item-id> --agent <codex|claude|gemini> --dry-run --json`: verifies the Work Item exists and is agent-eligible, then prints a deterministic manual paste context bundle with `AGENTS.md`, the rendered Work Item projection, dependency view, related document projections, validation commands, and scope reminders. Dry run does not execute agents, write run artifacts, mutate source code, or mark Work Items done.
- `prepare <work-item-id> --agent <codex|claude|gemini> --apply --json`: writes a local handoff record under `planning/runs/run-YYYYMMDD-HHMMSS-<work-item-id>/` with `metadata.json`, `prompt.md`, and `context.md`. JSON reports the run id, metadata, and created paths. These run artifacts are not ignored by default because they are local, git-reviewable evidence of what was handed to an agent. Use `prompt.md` as the manual paste prompt and `context.md` to inspect or reproduce the exact context bundle. Apply mode does not execute an agent, mutate graph state, or mark Work Items done.
- `run <work-item-id> --agent <codex|claude|gemini> --json`: verifies the Work Item is agent-eligible and AFK-ready, creates the same context bundle, invokes the selected local coding-agent CLI, then runs the Work Item validation commands. It writes `metadata.json`, `prompt.md`, `context.md`, `runner-stdout.log`, `runner-stderr.log`, `validation-stdout.log`, `validation-stderr.log`, and `result.json` under `planning/runs/run-YYYYMMDD-HHMMSS-<work-item-id>/`. Missing binaries return failed JSON with `runner.error.code: runner_not_found`; Codex auth preflight failures return `runner.error.code: runner_auth_failed`; agent timeouts return `runner.error.code: runner_timeout`; agent output caps return `runner.error.code: runner_output_limit_exceeded`; validation timeouts and output caps are reported on validation commands with `validation_command_timeout` or `validation_command_output_limit_exceeded`. Truncated output artifacts include `[planner: stdout truncated after N bytes]` or `[planner: stderr truncated after N bytes]`, and `result.json` reports per-stream byte counts and truncation flags. Validation failures return failed JSON with `validation.status: "fail"`. Running a coding agent may modify your working tree; review the saved run artifacts and working tree before accepting any changes.
- `run review <run-id> --json`: reads saved `metadata.json` and `result.json` from `planning/runs/<run-id>/` and summarizes the Work Item, agent exit code, validation results, changed files when present in the run result, and artifact paths.
- `run accept <run-id> --json` / `run reject <run-id> --json`: appends an audit event to `planning/change-log.ndjson` for the human decision. These commands do not change Work Item state, commit files, or delete run artifacts.
- `sync github --dry-run --json`: previews deterministic GitHub Issue payloads for Work Items, including title, body, labels, dependencies, and references. Dry run does not require credentials, call GitHub, create issues, or mutate external trackers. Live tracker sync is deferred.

Commands do not prompt unless future interactive behavior is explicitly requested with `--interactive`.

## Publishing

The npm package publishes as `@mudabbirulsaad/theplanner` and installs the `theplanner` command.

```sh
npm whoami
npm run check
npm pack --dry-run
npm publish --access public
```

Before publishing a new version, confirm the package name and version with `npm view @mudabbirulsaad/theplanner version`.

## Schema Version Policy

V1 supports Planning Graph `schema_version` value `0.1.0` only. Runtime JSON Schema validation pins this value before semantic validation runs, and core validation also reports unsupported versions when called directly.

Unsupported versions fail validation with a clear error. V1 does not provide graph migrations; future schema versions must add an explicit migration adapter or document a migration-unavailable failure before they are accepted.

## Agent Runner Commands

`theplanner run` is a local process runner only. It sends the generated prompt to the selected command on stdin and sets `PLANNER_AGENT`, `PLANNER_RUN_ID`, `PLANNER_WORK_ITEM_ID`, and `PLANNER_RUN_DIRECTORY` in the child process environment.

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

- `src/core/`: pure domain logic for graph types, graph operations, validation, readiness, projection rendering, and reconciliation.
- `src/application/`: use cases and ports for graph storage, projection IO, CLI orchestration, graph operation proposal, approval orchestration, agent context selection, and change-log writing.
- `src/adapters/`: CLI, filesystem, process, tracker, schema, repo-scan, and future LLM provider implementations.
- `tests/core/`: domain tests.
- `tests/application/`: use-case tests with fakes.
- `tests/integration/`: CLI and dependency-boundary tests.

`src/core/**` must not import CLI, filesystem, Git, LLM provider, Repo Scan, schema adapter, or other infrastructure code.

Future LLM provider code belongs under `src/adapters/llm/`. These adapters may call provider APIs and parse provider output, but they must satisfy application-layer ports and return proposed graph operations. They must not import graph repositories or projection writers, and they must not directly mutate canonical files.

The intended flow is:

```text
Intake Brief / user answer / run result
  -> GraphOperationProposer port
  -> src/adapters/llm/<provider> proposal adapter
  -> ProposedGraphOperation JSON
  -> core graph-operation candidate apply
  -> JSON Schema validation
  -> semantic Graph Validation
  -> Graph Operation Approval when required
  -> graph save, change-log append, projection regeneration
```

## Known V1 Limitations

- `theplanner plan` supports dry-run JSON proposals and explicit new-graph creation with `--apply`; updates to existing non-empty graphs and force overwrite flows are deferred.
- Runtime JSON Schema validation covers the current `planning/graph.schema.json` keyword set before semantic validation. V1 supports only `schema_version: "0.1.0"` and reports unsupported versions instead of migrating them.
- Reconciliation intentionally treats `planning/graph.json` as canonical. It can propose patches for selected Work Item fields and deterministic Open Question edits in PRD/architecture projections, but decision/component/risk references and freeform implementation notes are reported as unsupported/deferred.
- External tracker sync is limited to `sync github --dry-run --json`; live external issue creation and credentialed tracker APIs are deferred.
- LLM cloud API adapters and live provider calls are not implemented.
- The Graph Operation pipeline is documented as the next architecture direction but is not implemented yet.
- `theplanner run` executes only one selected local CLI agent for one Work Item and then runs the Work Item validation commands. Multi-agent orchestration, automatic Work Item state changes, and autonomous acceptance/rejection remain deferred.
- Validation commands are executed directly as argv-style process commands. Shell operators such as `&&` require an explicit shell command wrapper.
- Run ids and audit event ids currently use second-level timestamps plus an in-process counter. Avoid starting multiple runs or opposite accept/reject decisions for the same run in the same second until id uniqueness is hardened.
- `PLANNER_RUN_DIRECTORY` is provided to the local agent command; agents that write inside it should create the directory if needed.
- Reconciled Open Questions that become execution-blocking are persisted to the graph, but downstream readiness/HITL implications still require a follow-up planning pass.
