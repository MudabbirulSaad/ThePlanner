# Issue 025: Add RFC Decision Planning Flow

## Goal

Make RFC projections useful by creating and rendering explicit Decision nodes from refined planning input.

## User Story

As a Primary User, I want important product and architecture choices to become Decisions with rationale and alternatives, so generated RFCs explain what was decided and what still needs approval.

## Scope

- Support extracting accepted, proposed, and revisit Decisions from refined briefs.
- Preserve selected option, rationale, and useful rejected alternatives where available.
- Render RFC Document Projections with decision context, affected nodes, alternatives, rationale, and unresolved questions.
- Validate Work Items that depend on unresolved Decisions cannot be AFK-ready.
- Add tests for brief-to-decision planning, RFC rendering, and readiness impact.

## Non-Goals

- Do not build an interactive decision workshop.
- Do not call live LLM providers.
- Do not implement approval UI beyond existing graph/apply/review commands.

## Implementation Notes

- Keep Decisions distinct from Assumptions. If the brief does not commit to a choice, create an Open Question or proposed Decision rather than pretending it is accepted.
- Reuse existing dependency-edge semantics where possible.

## Acceptance Criteria

- A refined brief with decision language creates Decision nodes with deterministic IDs.
- RFC projection output contains meaningful decision sections rather than only a title list.
- Work Items depending on proposed or revisit Decisions are not AFK-ready.
- Regression tests cover accepted and unresolved Decision cases.

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
issues/done/025-add-rfc-decision-planning-flow.md
```
