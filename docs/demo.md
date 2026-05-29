# Demo Guide

This demo shows the V1 MVP loop for the AI Engineering Planner: canonical Planning Graph, Markdown-first projections, validation, reconciliation, and planning change-log support.

## Commands

Build from the repository root. Run demo CLI commands from `examples/ai-engineering-planner-v1/` so the default `planning/graph.json` target is the preserved V1 dogfood graph.

```sh
npm install
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
cd examples/ai-engineering-planner-v1
node ../../dist/src/adapters/cli/index.js status --json
node ../../dist/src/adapters/cli/index.js validate --json
node ../../dist/src/adapters/cli/index.js export --dry-run --json
node ../../dist/src/adapters/cli/index.js export --apply --json
node ../../dist/src/adapters/cli/index.js reconcile --json
```

## Expected Output

- `npm run build`: TypeScript compiles without errors.
- `npm test`: Vitest reports all test files and tests passing.
- `npm run lint`: ESLint completes without findings.
- `npm run check`: build, tests, and lint all pass.
- `npm run validate:graph`: reports the clean starter graph with `graph_version: 1`, `status: pass`, `schema_status: pass`, `schema_errors: 0`, `errors: 0`, and `warnings: 0`.
- `status --json`: reports graph version 6, status `pass`, all eight Work Items AFK-ready and agent-eligible, and no blocked or HITL-gated Work Items.
- `validate --json`: reports schema status, schema errors, semantic status, errors, warnings, readiness summary, and readiness snapshots.
- `export --dry-run --json`: reports deterministic projection paths that would be created, updated, or left unchanged without writing files, plus possible human-authored Markdown sections that apply would overwrite.
- `export --apply --json`: writes deterministic projection paths from the graph. Projection Markdown is generated output, so review dry-run output first when local notes may exist.
- `reconcile --json`: reports proposed safe patches, conflicts, unsupported projection edits, inspected paths, and `applied: false`.

## MVP Flow

The demo `examples/ai-engineering-planner-v1/planning/graph.json` is the source of truth for the preserved V1 sample. It contains requirements, decisions, Work Items, execution slices, dependency edges, readiness snapshots, and document projection metadata.

Markdown-first repository export renders graph state into local, diffable artifacts under the demo workspace's `planning/`, `docs/prd/`, `docs/rfc/`, and `docs/architecture/` paths. These files are projections, not independent canonical state.

Validation checks graph JSON Schema shape, graph semantics, and derived readiness. In the current MVP graph, all eight Work Items are done, AFK-ready, and agent-eligible.

Projection rendering writes predictable Markdown and structured planning artifacts from the canonical graph. This supports repository-native review without external services.

Reconciliation reads Work Item Markdown and proposes safe V1 graph patches where supported. It does not mutate unless `--apply` is explicitly passed, and it does not silently treat Markdown as canonical truth.

The planning change log at `planning/change-log.ndjson` records graph-changing events with graph version transitions, affected nodes, approval status, summary, and provenance. Applied reconciliation patches write a change-log event.

## Known V1 Limitations

- No live LLM calls.
- No external tracker sync.
- No autonomous multi-agent execution. `planner run` can invoke Codex explicitly for one Work Item, then human review is still required through saved run artifacts and accept/reject audit events.
- `planner plan` supports dry-run JSON proposals and explicit new-graph creation with `--apply`; updates to existing non-empty graphs are deferred.
- CLI validation runs JSON Schema validation before semantic validation; semantic validation is skipped when schema validation fails.
- Reconciliation supports safe V1 fields and reports richer Markdown sections or unsupported relationships as `unsupportedProjectionEdits`.
