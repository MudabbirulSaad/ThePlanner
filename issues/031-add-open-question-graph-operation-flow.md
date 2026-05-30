# Issue 031: Add Open Question Graph Operation Flow

## Goal

Introduce the first end-to-end Graph Operation path by letting a proposed Open Question become a validated candidate graph change.

## User Story

As a Primary User, I want uncertain planning input to become explicit Open Questions through a safe proposal pipeline, so LLMs and future integrations cannot mutate the Planning Graph directly.

## Scope

- Add a core Graph Operation model for at least an `AddOpenQuestion` operation.
- Apply the operation to a candidate Planning Graph without mutating the original graph.
- Require provenance on generated or inferred Open Question proposals.
- Validate the candidate graph after applying the operation.
- Add application coverage that proves proposed operations are validated before any canonical save.
- Add a narrow CLI or use-case dry-run path that can accept a proposed operation JSON fixture and report the candidate result without writing files.

## Non-Goals

- Do not add live LLM provider calls.
- Do not support every Graph Operation kind in this issue.
- Do not write projection files from the proposed operation path.
- Do not bypass existing graph JSON parse/serialize compatibility.

## Implementation Notes

- Keep mutation semantics in `src/core/`.
- Keep proposal orchestration in `src/application/`.
- Any adapter or CLI path should call the application use case, not core internals directly.
- Use the ADR/RFC language: Proposed Graph Operations are untrusted until validated.

## Acceptance Criteria

- A valid `AddOpenQuestion` proposal produces a candidate graph with the new Open Question and incremented graph version only in the candidate result.
- An invalid `AddOpenQuestion` proposal is rejected with useful validation output.
- The original graph is not mutated during dry-run.
- Tests cover deterministic application, provenance, validation failure, and no direct graph save during dry-run.

## Blocked by

- None - can start immediately

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
issues/done/031-add-open-question-graph-operation-flow.md
```
