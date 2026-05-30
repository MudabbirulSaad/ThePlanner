# Issue 040: Add LLM Adapter Scaffold and Fixtures

## Goal

Create the provider adapter structure for future Codex, Claude, and Gemini proposal engines without making live provider calls.

## User Story

As a maintainer, I want provider-specific LLM adapter code isolated under `src/adapters/llm/`, so future live integrations cannot leak into the core domain or bypass Graph Operation validation.

## Scope

- Add `src/adapters/llm/` with provider-specific scaffolds for Codex, Claude, and Gemini proposal adapters.
- Ensure adapters satisfy the application `GraphOperationProposer` port.
- Use fixture responses or fake process/API clients in tests.
- Parse fixture provider output into Proposed Graph Operations.
- Prove adapters do not write graph files, projection files, run artifacts, change logs, or source files.
- Add dependency-boundary coverage for the new adapter area if needed.

## Non-Goals

- Do not call live Codex, Claude, Gemini, or cloud APIs.
- Do not add provider auth flows.
- Do not implement full prompt optimization.
- Do not mutate canonical graph state from adapter tests.

## Implementation Notes

- Provider prompts and response parsing belong in adapters, not core.
- Keep fixtures small and deterministic.
- The acceptance path should remain: adapter proposal, application validation, graph operation pipeline.
- Few-shot prompting prep: fixture parsing and adapter structure should allow documented Proposed Graph Operation JSON examples from Issue 041 to be injected directly into future LLM system prompts as few-shot examples without reformatting.

## Acceptance Criteria

- Codex, Claude, and Gemini adapter scaffolds can return Proposed Graph Operations from deterministic fixtures.
- Adapter tests prove proposals go through the GraphOperationProposer port shape.
- No adapter has access to direct graph or projection writers.
- No live provider calls occur during tests.

## Blocked by

- Issue 036: Add Graph Operation Proposer Port

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
issues/done/040-add-llm-adapter-scaffold-and-fixtures.md
```
