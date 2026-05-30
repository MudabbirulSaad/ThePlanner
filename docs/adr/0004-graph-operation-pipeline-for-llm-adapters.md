# Graph Operation Pipeline for LLM Adapters

Status: accepted

Date: 2026-05-30

## Context

ThePlanner is moving from deterministic rule-based planning toward LLM-assisted planning and execution. Codex, Claude, Gemini, and future providers can help transform an Intake Brief into requirements, decisions, Work Items, HITL gates, execution slices, and reviewer findings.

The Planning Graph remains the canonical source of truth. Markdown files are projections. If provider adapters write directly to `planning/graph.json` or projection files, the product loses deterministic validation, provenance, approval policy, graph versioning, and useful audit history.

## Decision

LLM adapters must be proposal engines only. They will return structured Proposed Graph Operations, not direct graph writes or projection edits.

The core domain will define Graph Operation semantics in `src/core/graph-operations.ts`. A Graph Operation is a deterministic domain command such as adding an Open Question, Requirement, Decision, Work Item, Dependency Edge, HITL Gate, or updating Work Item execution state.

The application layer will define a GraphOperationProposer port. Provider implementations for Codex, Claude, Gemini, and future LLMs will live under `src/adapters/llm/` and satisfy that port.

The write path is:

```text
Intake Brief, user answer, repo context, or run result
  -> GraphOperationProposer
  -> LLM adapter or deterministic proposer
  -> Proposed Graph Operations
  -> core candidate graph application
  -> JSON Schema validation
  -> semantic Graph Validation
  -> Graph Operation Approval when required
  -> canonical graph save
  -> Planning Change Log event
  -> projection regeneration
```

LLM adapters must not write `planning/graph.json`, `planning/graph.schema.json`, PRD/RFC/Architecture projections, Work Item projections, dependency views, run audit files, or `planning/change-log.ndjson` directly.

## Validation Rules

Every Proposed Graph Operation is untrusted until validated.

An LLM-proposed Work Item must include:

- Acceptance Criteria.
- At least one executable command or test Validation Method.
- Context summary.
- Boundary notes.
- Traceability to a Requirement or accepted Decision.
- Safe-failure guidance.
- Provenance identifying the proposal source.

Untestable LLM-proposed Work Items are rejected immediately. They are not accepted as vague manual-review tasks.

Commitment-changing, scope-changing, risk-changing, readiness-changing, architecture-changing, or safety-relevant operations require Graph Operation Approval before they affect canonical graph state.

## Consequences

This keeps Hexagonal Architecture intact. Core owns graph mutation semantics and validation. Application owns orchestration and ports. Adapters own provider-specific calls, prompts, response parsing, and auth concerns.

Provider integrations become replaceable because Codex, Claude, Gemini, and fake test proposers all satisfy the same application-layer port.

The first implementation work should build and test the Graph Operation control layer before live LLM provider calls. This avoids embedding domain policy in provider prompts or adapter code.

The reviewer loop must also use Graph Operations. A Reviewer LLM may propose an execution-state update, follow-up Work Item, Open Question, or HITL Gate, but it must not directly mark Work Items done, mutate graph files, write projections, or commit code.

