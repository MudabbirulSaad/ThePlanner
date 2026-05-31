# Issue 048: Reject Scaffold-Heavy Planning Graphs From Trusted Export

## Type

AFK

## Complexity

Medium

## Primary User Effort

Low

## Goal

Make ThePlanner visibly reject or warn on scaffold-heavy Planning Graphs before those graphs are treated as trusted execution input.

## User Story

As a Primary User, I want scaffold-heavy Planning Graphs to be flagged before export or execution handoff, so I do not mistake placeholder Document Projections for implementation-ready planning artifacts.

## Scope

- Add deterministic planning-quality checks for scaffolded Product Intent, TODO placeholders, empty or missing RFC Decisions, generic Components, and fallback Work Items.
- Surface planning-quality findings in CLI output where graph safety is evaluated before export or use.
- Keep Graph Validation responsible for structural and semantic safety, while making low-signal planning quality visible and testable.
- Add fixture-backed tests for a scaffold-heavy Planning Graph and a richer Planning Graph.

## Non-Goals

- Do not call live LLM providers.
- Do not replace the deterministic scaffold planner in this issue.
- Do not change Graph Operation approval rules.
- Do not prevent dry-run output for exploratory workflows.

## Implementation Notes

- The visible dogfood run showed that structurally valid Document Projections can still be too scaffolded for reliable AFK execution.
- Prefer a focused quality Module or validation mode over scattering TODO checks across projection rendering and CLI commands.
- Preserve Hexagonal Architecture: core may classify graph quality, application may decide when to block or warn, adapters only present results.

## Acceptance Criteria

- Scaffold-heavy Product Intent with TODO placeholders produces planning-quality findings.
- Empty RFC Decisions or missing architecture-significant Decisions are reported.
- Generic Components and fallback Work Items are reported without breaking clean existing graphs.
- `export --dry-run` or `export --apply` exposes quality findings before the Primary User relies on generated Document Projections.
- Tests cover at least one scaffold-heavy graph and one graph that remains acceptable.

## Blocked by

None - can start immediately.

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
issues/done/048-reject-scaffold-heavy-planning-graphs-from-trusted-export.md
```
