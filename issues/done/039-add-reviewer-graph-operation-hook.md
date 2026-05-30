# Issue 039: Add Reviewer Graph Operation Hook

## Goal

Add a reviewer hook that turns agent run results and validation output into proposed Graph Operations instead of directly changing Work Item state.

## User Story

As a Primary User, I want reviewer output to follow the same validation and approval path as planning output, so agent execution cannot silently mark work done or loop forever after failure.

## Scope

- Add an application reviewer proposal path that ingests run artifacts, validation summary, changed file summary when available, and compact graph context.
- Use a fake reviewer proposer in tests.
- On passing validation, allow the reviewer to propose `UpdateWorkItemExecutionState`.
- On failing validation, allow the reviewer to propose a HITL Gate, Open Question, Risk, or blocked follow-up Work Item.
- Ensure reviewer proposals go through Graph Operation validation before canonical apply.
- Prevent continuous retry-loop behavior by requiring failure to surface as a proposed blocker/HITL path.

## Non-Goals

- Do not call live LLM providers.
- Do not auto-commit Git changes.
- Do not directly mutate Work Item state from reviewer output.
- Do not replace existing human `run review`, `run accept`, or `run reject` audit commands.

## Implementation Notes

- Keep reviewer as a proposal source, not final authority.
- Reuse the graph operation apply pipeline rather than creating a separate mutation path.
- The hook can be dry-run first if apply behavior needs explicit approval handling.

## Acceptance Criteria

- A passing run can produce a proposed Work Item execution-state update through the reviewer hook.
- A failing run produces a proposed blocker/HITL-style operation instead of retrying automatically.
- Reviewer proposals are rejected if they fail graph operation or semantic validation.
- Tests prove reviewer output cannot directly save graph state.

## Blocked by

- Issue 036: Add Graph Operation Proposer Port
- Issue 038: Add Execution Slice Context Selector

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
issues/done/039-add-reviewer-graph-operation-hook.md
```
