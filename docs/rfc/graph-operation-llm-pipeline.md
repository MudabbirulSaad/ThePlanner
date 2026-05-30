# RFC: Graph Operation LLM Pipeline

Status: draft

Date: 2026-05-30

## Summary

ThePlanner will integrate LLM adapters through a Graph Operation pipeline. LLMs can propose planning changes, clarification questions, execution-state updates, and reviewer outcomes, but they cannot directly mutate canonical graph files or generated projections.

This RFC defines the intended planning-to-execution flow:

```text
brainstorming
  -> Proposed Graph Operations
  -> validation and approval
  -> Planning Graph
  -> PRD / architecture / RFC / Work Item projections
  -> compact execution context
  -> coding agent run
  -> validation commands
  -> reviewer proposal
  -> Graph Operations
```

## Goals

- Preserve `planning/graph.json` as the canonical source of truth.
- Allow Codex, Claude, Gemini, and future providers to assist planning without becoming hidden mutation engines.
- Make graph mutations deterministic, reviewable, validated, and auditable.
- Require testable Work Items before autonomous execution.
- Keep provider-specific code outside the core domain.
- Support a grilling workflow where missing context becomes explicit Open Questions before commitments are made.
- Support an autonomous reviewer hook without allowing continuous retry loops or direct graph mutation.

## Non-Goals

- Live provider implementation in the core domain.
- Direct LLM edits to Markdown projections.
- Direct LLM writes to `planning/graph.json`.
- Silent acceptance of architecture decisions, scope commitments, or safety-sensitive changes.
- Continuous autonomous retry loops after failed validation.
- Provider-specific prompts in `src/core/`.

## Core Concepts

`GraphOperation` is a deterministic domain command that describes one intended graph mutation.

Examples:

- `AddOpenQuestion`
- `AddRequirement`
- `AddDecision`
- `AddWorkItem`
- `AddDependencyEdge`
- `AddHitlGate`
- `UpdateWorkItemExecutionState`
- `ArchiveNode`

`ProposedGraphOperation` is an untrusted operation candidate. It can come from an LLM adapter, reconciliation, repo scan, CLI flow, reviewer hook, or future tracker integration.

`GraphOperationProposer` is an application-layer port. LLM adapters satisfy this port, but fake deterministic proposers can satisfy it in tests.

## Hexagonal Boundaries

`src/core/graph-operations.ts` should own:

- Graph Operation types.
- Operation validation.
- Deterministic candidate-graph application.
- Provenance requirements.
- Approval classification.
- Graph version implications.

`src/application/` should own:

- `GraphOperationProposer` port.
- Use cases that request proposals.
- Candidate graph validation orchestration.
- Approval workflow orchestration.
- Change-log event creation.
- Projection regeneration calls after accepted operations.

`src/adapters/llm/` should own:

- Codex adapter.
- Claude adapter.
- Gemini adapter.
- Provider prompts.
- Provider auth/config concerns.
- Response parsing into Proposed Graph Operations.

LLM adapters must not import graph repositories, projection writers, change-log writers, or filesystem graph mutation adapters.

## Phase 1: Control Layer

Build the core Graph Operation layer before live provider calls.

Required behavior:

- Apply operations to a candidate graph without mutating the original graph.
- Reject malformed operations.
- Preserve deterministic node IDs and graph version behavior.
- Attach provenance to generated or inferred nodes.
- Classify which operations require approval.
- Reject LLM-proposed Work Items without Acceptance Criteria.
- Reject LLM-proposed Work Items without executable command or test Validation Methods.
- Reject LLM-proposed Work Items without context summary, boundary notes, traceability, or safe-failure guidance.

The first tests should be core tests. They should prove invalid LLM proposals cannot enter the canonical graph.

## Phase 2: Grilling Interface

Add `GraphOperationProposer` in the application layer.

When a proposer lacks context, it should return `AddOpenQuestion` proposals instead of inventing requirements or decisions. The CLI can then present the questions to the Primary User as a grilling session.

User answers should be fed back to the proposer as source material. The next proposal round may produce `AddRequirement`, `AddDecision`, `AddAssumption`, `AddRisk`, or `AddHitlGate` operations. Commitment-changing results still require approval before apply.

This keeps ambiguity visible and prevents hidden assumptions from becoming canonical graph state.

## Phase 3: Provider Adapters and Reviewer Hook

Implement provider adapters under `src/adapters/llm/`:

- Codex.
- Claude.
- Gemini.

Each adapter should return Proposed Graph Operations and provider diagnostics. Provider-specific prompt formats are adapter details.

Execution context should be compacted before invoking a coding agent. The selector should include only:

- Active Execution Slice.
- Selected Work Item.
- Immediate Dependency Edges.
- Directly referenced Requirements, Decisions, Components, Risks, Open Questions, and HITL Gates.
- Validation commands and safe-failure guidance.
- Relevant local instructions such as `AGENTS.md`.

The reviewer hook should ingest:

- Executor final output.
- Runner stdout/stderr summaries.
- Validation command output.
- Changed file summary when available.
- Compact graph context.

The reviewer may propose:

- `UpdateWorkItemExecutionState` to `done` when validation passes.
- `AddWorkItem` for follow-up work.
- `AddOpenQuestion` for uncertainty.
- `AddHitlGate` for manual intervention.
- `AddRisk` when failure reveals a planning risk.

On failed validation, the system must not run an infinite autonomous retry loop. It should propose or create a blocked state and a HITL Gate with a clear cause.

## Acceptance Criteria for the Pipeline

- No LLM adapter can directly write canonical planning files.
- Every proposed graph mutation can be rendered as JSON and reviewed.
- Every applied mutation has provenance and a change-log event.
- Invalid proposed operations fail before graph save.
- LLM-proposed Work Items without executable validation are rejected.
- Human approval is required for commitment-changing operations.
- Reviewer output follows the same proposal and validation path as planning output.

