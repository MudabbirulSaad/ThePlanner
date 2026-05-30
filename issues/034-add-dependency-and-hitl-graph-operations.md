# Issue 034: Add Dependency and HITL Graph Operations

## Goal

Support graph operations that make execution blockers explicit by adding Dependency Edges and HITL Gates through the validated proposal pipeline.

## User Story

As a Primary User, I want proposed dependencies and human-intervention gates to be validated before they affect readiness, so agent execution is blocked for clear graph reasons instead of hidden ambiguity.

## Scope

- Add `AddDependencyEdge` operation support.
- Add `AddHitlGate` operation support.
- Validate source and target node references before candidate graph apply.
- Require HITL Gates to include required action, blocked Work Items, and cause links.
- Recompute readiness on candidate graphs affected by new dependencies or HITL Gates.
- Add tests for missing references, self-dependencies where invalid, missing HITL actions, and readiness changes.

## Non-Goals

- Do not add reviewer automation yet.
- Do not implement retry-loop prevention yet.
- Do not change existing dependency edge direction semantics.

## Implementation Notes

- Follow current Dependency Edge direction: `source -> target` means the source has the relationship to the target.
- Use existing validation rules for blocker cause links and HITL blocked Work Items.
- Keep candidate graph application deterministic and side-effect free.

## Acceptance Criteria

- A valid dependency edge proposal updates candidate graph relationships and validation output.
- A valid HITL Gate proposal blocks the intended Work Item in candidate readiness.
- Invalid references or missing HITL required actions are rejected before save.
- Tests prove canonical graph state is unchanged until apply is explicitly requested.

## Blocked by

- Issue 033: Add Testable Work Item Graph Operation

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
issues/done/034-add-dependency-and-hitl-graph-operations.md
```
