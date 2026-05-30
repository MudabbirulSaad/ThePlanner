# Issue 041: Add Graph Operation Schema and Docs

## Goal

Document and validate the Proposed Graph Operation JSON contract so humans, agents, and provider adapters can exchange proposals consistently.

## User Story

As a Primary User, I want proposed graph operations to have a documented JSON shape, so I can review and hand them to AFK agents or adapters without guessing the contract.

## Scope

- Add a JSON Schema or schema-like runtime validator for Proposed Graph Operation input.
- Document supported operation kinds, required fields, provenance, approval behavior, and examples.
- Include examples for Open Question, Requirement, Decision, Work Item, Dependency Edge, HITL Gate, and Work Item execution-state update where supported.
- Update README or docs to point to the operation contract.
- Add tests that validate example proposal files.

## Non-Goals

- Do not add new operation kinds beyond those already implemented by prior issues.
- Do not call live LLM providers.
- Do not make the operation schema replace `planning/graph.schema.json`.

## Implementation Notes

- The operation schema validates proposal input; `planning/graph.schema.json` still validates canonical graph shape.
- Keep examples deterministic and useful for AFK agents.
- Avoid claiming unsupported operations are implemented.
- Runtime vs static typing: use a strict parsing library such as Zod or TypeBox for the Proposed Graph Operation runtime validator instead of hand-rolled JSON checks. The operation union should provide both the runtime firewall for hallucinated LLM JSON and safe static TypeScript types for the application layer.

## Acceptance Criteria

- Proposed Graph Operation examples validate successfully.
- Malformed operation examples fail with useful errors.
- Documentation explains the difference between operation schema validation and Planning Graph validation.
- README or docs link to the proposal contract.

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
issues/done/041-add-graph-operation-schema-and-docs.md
```
