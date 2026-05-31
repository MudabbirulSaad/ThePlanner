# Issue 043: Generate Execution-Focused Work Items from MVP Scope

## Goal

Improve `plan --from <refined-brief> --apply` so generated Work Items are implementation-oriented execution slices instead of generic planning scaffolds.

## User Story

As a Primary User, I want an advanced product brief to produce Work Items that can become AFK-ready implementation slices, so the planner moves from PRD/architecture into real agent execution without manual graph surgery.

## Scope

- Derive narrow Work Items from MVP scope, success criteria, constraints, and component hints.
- Give each generated Work Item concrete context, boundaries, acceptance criteria, validation methods, and safe-failure guidance.
- Prefer executable validation commands when repo scan or package scripts expose a deterministic test command; otherwise keep safe manual validation explicit.
- Trace generated Work Items to the relevant Requirements, accepted Decisions, Components, and Risks.
- Keep Work Items blocked only by truly blocking Decisions, Open Questions, Risks, Assumptions, or HITL Gates.
- Add golden or fixture coverage for an advanced todo-style refined brief.

## Non-Goals

- Do not call live LLM providers to generate Work Items.
- Do not infer deep repository architecture from source code beyond already available deterministic scan/config inputs.
- Do not make every generated Work Item AFK-ready when required validation or context is genuinely missing.

## Implementation Notes

- Dogfooding showed the current default Work Items are useful planning scaffolds but not natural implementation slices.
- Keep this vertical: the CLI should produce better graph nodes, exported Work Item Markdown should improve, readiness should be meaningful, and tests should cover the full path.
- Maintain deterministic IDs and ordering.

## Acceptance Criteria

- An advanced todo refined brief produces Work Items named around product implementation slices, not only `Create canonical planning graph`, `Implement component boundaries`, and `Validate and review planning projections`.
- Generated Work Items include context summary, boundary notes, acceptance criteria, validation methods, and safe-failure guidance.
- Exported Work Item projections contain enough scoped context for `prepare --dry-run` to be useful.
- Tests prove non-blocking open questions do not prevent generated implementation Work Items from becoming preparable.

## Blocked by

- Issue 042: Honor Non-Blocking Open Question Markers

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
issues/done/043-generate-execution-focused-work-items-from-mvp-scope.md
```
