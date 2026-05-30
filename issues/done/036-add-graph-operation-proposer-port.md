# Issue 036: Add Graph Operation Proposer Port

## Goal

Add the application-layer proposal port that future LLM adapters and deterministic fakes can use to return Proposed Graph Operations.

## User Story

As a maintainer, I want planning proposal sources behind a GraphOperationProposer port, so Codex, Claude, Gemini, and test fakes all flow through the same validation and approval path.

## Scope

- Define a `GraphOperationProposer` application port.
- Add a use case that requests proposals from the port and returns validated dry-run results.
- Add a fake deterministic proposer for tests.
- Prove proposer output cannot bypass graph operation validation.
- Include intake brief or user-answer input enough to support the next grilling slice.
- Keep provider-specific prompts and API details out of this issue.

## Non-Goals

- Do not call live LLM providers.
- Do not implement Codex, Claude, or Gemini adapters.
- Do not create an interactive CLI grilling loop yet.
- Do not write canonical graph state from proposer output unless it goes through the existing operation apply path.

## Implementation Notes

- The port belongs in `src/application/`, not `src/core/`.
- Tests should use fake proposers and fixture proposals.
- Keep the proposer return type structured and JSON-friendly.

## Acceptance Criteria

- A fake proposer can return Proposed Graph Operations from intake/user-answer input.
- The application use case validates proposer output through the graph operation pipeline.
- Invalid fake proposer output is rejected before graph save.
- Dependency-boundary tests still prove core does not import application or adapters.

## Blocked by

- Issue 035: Add Graph Operation Apply Command

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
issues/done/036-add-graph-operation-proposer-port.md
```
