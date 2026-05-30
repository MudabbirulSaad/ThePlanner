# Issue 046: Add Fixture-Backed Intake Grill CLI Path

## Goal

Make `intake grill --dry-run` usable from the built CLI without live LLM providers by adding a deterministic fixture-backed proposer path.

## User Story

As a Primary User, I want to dogfood the grilling session locally, so I can see proposed Open Questions and answer flow behavior before live Codex, Claude, or Gemini adapters are configured.

## Scope

- Add a CLI-accessible deterministic proposer option for `intake grill --dry-run`.
- Allow the proposer to read fixture provider output or a local proposal file and route it through the existing `GraphOperationProposer` and Graph Operation validation path.
- Keep the command read-only: no graph, projection, run artifact, change-log, or source writes.
- Return useful JSON and human-readable output for proposed Open Questions.
- Add CLI integration tests proving the path works without live providers.

## Non-Goals

- Do not call live LLM providers.
- Do not add provider auth flows.
- Do not make `intake grill` apply graph changes.
- Do not bypass Proposed Graph Operation schema validation.

## Implementation Notes

- Dogfooding showed the command currently fails with `theplanner intake grill requires a graph operation proposer` in the real CLI.
- Prefer an explicit flag such as a fixture/proposal input over hidden defaults, so production behavior remains clear.
- Reuse the LLM adapter fixtures or Proposed Graph Operation examples where possible.

## Acceptance Criteria

- A user can run `intake grill --from <brief> --dry-run --json` with a deterministic fixture/proposal option and receive validated proposed Open Questions.
- Invalid fixture/proposal output is rejected with useful parser errors.
- The command writes no planning files.
- Tests prove no live provider calls occur.

## Blocked by

- Issue 040: Add LLM Adapter Scaffold and Fixtures
- Issue 041: Add Graph Operation Schema and Docs

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
issues/done/046-add-fixture-backed-intake-grill-cli-path.md
```
