# Issue 053: Route Normal Planning Through Graph Operation Proposals

## Type

HITL first, then AFK

## Complexity

High

## Primary User Effort

High

## Goal

Make the normal Intake Brief planning path use GraphOperationProposer when configured, while keeping deterministic scaffold planning explicit as a fallback.

## User Story

As a Primary User, I want `plan --from <brief>` to use the Proposed Graph Operation pipeline when a proposer is configured, so ThePlanner produces concrete Planning Graph changes without bypassing validation, approval, or provenance.

## Scope

- Add a clear planner path that routes Intake Brief content through GraphOperationProposer and candidate Graph Operation validation.
- Keep Proposed Graph Operations untrusted until schema validation, semantic Graph Validation, and approval requirements pass.
- Preserve deterministic scaffold behavior as an explicit fallback or explicit mode, not an invisible default when a proposer is available.
- Add CLI output that tells the Primary User which planning mode ran.
- Add tests for proposer configured, proposer absent, rejected proposal, and approval-required proposal.

## Non-Goals

- Do not call live LLM providers.
- Do not let LLM adapters write graph files or Document Projections directly.
- Do not remove `graph-operation` dry-run/apply commands.
- Do not bypass Graph Operation Approval.

## HITL Decision Required

Before implementation, decide the product behavior:

- Should proposer-backed planning become the default whenever a GraphOperationProposer is configured?
- Should proposer-backed planning require an explicit flag such as `--propose-operations`?
- Should deterministic scaffold `plan --apply` remain available only under an explicit scaffold flag?

Record the decision in the issue or an ADR before handing the implementation portion to an AFK coding agent.

## HITL Decision

- Proposer-backed planning is the default whenever a `GraphOperationProposer` is configured.
- Deterministic scaffold planning remains available as an explicit `--scaffold` mode, and is also the clearly reported fallback when no proposer is configured.
- `plan --apply` through proposed Graph Operations requires explicit approval with `--approved` or proposal-level approval for approval-required operations.

## Implementation Notes

- ADR-0004 requires LLM adapters to be proposal engines only.
- The existing `intake grill --dry-run` and `graph-operation` paths already exercise pieces of this pipeline.
- Keep Hexagonal Architecture intact: core owns graph operation semantics and validation; application owns orchestration; adapters own provider-specific behavior.

## Acceptance Criteria

- `plan --from <brief> --dry-run` can produce a candidate graph through Proposed Graph Operations when a proposer is configured.
- `plan --from <brief> --apply` refuses approval-required operations unless explicit approval is present.
- When no proposer is configured, deterministic scaffold mode is clearly reported.
- Rejected proposals do not mutate `planning/graph.json`, projections, or change log files.
- Tests cover proposer configured, proposer absent, rejected proposal, and approval-required proposal paths.

## Blocked by

- Issue 048: Reject Scaffold-Heavy Planning Graphs From Trusted Export
- Issue 049: Keep Scaffolded Work Items Out Of AFK-Ready
- HITL decision in this issue

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
issues/done/053-route-normal-planning-through-graph-operation-proposals.md
```
