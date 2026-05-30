# Issue 032: Add Requirement and Decision Graph Operations

## Goal

Extend the Graph Operation pipeline beyond Open Questions so validated proposals can add Requirements and Decisions while preserving approval semantics.

## User Story

As a Primary User, I want answers from a grilling session to become proposed Requirements and Decisions, so planning commitments enter the graph through validation and approval instead of provider-written files.

## Scope

- Add `AddRequirement` and `AddDecision` operation support.
- Apply each operation to a candidate graph with deterministic IDs and provenance.
- Require explicit approval classification for accepted or commitment-changing Decisions.
- Preserve proposed/revisit Decision status behavior where approval is not yet granted.
- Validate candidate graphs after operation application.
- Add tests for valid proposals, malformed proposals, approval-required proposals, and graph version behavior.

## Non-Goals

- Do not add provider-specific LLM adapters.
- Do not implement a full grilling CLI loop.
- Do not support Work Item creation in this issue.
- Do not auto-accept architecture or scope decisions.

## Implementation Notes

- Keep approval classification deterministic and provider-independent.
- Use existing Decision fields: selected option, rationale, rejected alternatives, unresolved questions, and status.
- If adding JSON proposal fixtures, keep them small and deterministic.
- Immutability mandate: candidate graph application must use strict deep-cloning or immutable structural sharing so dry-run operation application cannot mutate the canonical graph object in memory through leaked JavaScript references.

## Acceptance Criteria

- A valid Requirement proposal can be applied to a candidate graph and passes validation.
- A valid proposed Decision can be applied without becoming silently accepted.
- An accepted or scope/architecture-changing Decision proposal is reported as requiring approval before canonical apply.
- Tests prove malformed Requirements or Decisions are rejected before save.

## Blocked by

- Issue 031: Add Open Question Graph Operation Flow

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
issues/done/032-add-requirement-and-decision-graph-operations.md
```
