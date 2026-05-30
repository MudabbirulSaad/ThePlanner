# Proposed Graph Operation Contract

Proposed Graph Operations are JSON proposals from humans, agents, or provider adapters. They are validated before any candidate graph is built. The canonical Planning Graph remains validated separately by `planning/graph.schema.json` and semantic Graph Validation.

This contract is the runtime firewall for proposal input. It rejects malformed JSON shapes, unknown fields, unsupported operation names, invalid enum values, and missing required fields. Passing this contract does not mean the operation can be applied: the candidate apply step still validates graph references, duplicate IDs, provenance policy, approval requirements, readiness changes, and the final Planning Graph.

## Envelope

Each proposal is one JSON object with an `operation` discriminator. Apply proposals may include top-level `"approved": true` when a graph operation requires approval.

```json
{
  "operation": "add_open_question",
  "approved": true
}
```

Supported operation names:

- `add_open_question`
- `add_requirement`
- `add_decision`
- `add_work_item`
- `add_dependency_edge`
- `add_hitl_gate`
- `update_work_item_execution_state`

The parser also accepts canonical TypeScript operation names such as `AddOpenQuestion`, but generated proposal files should use the snake_case names above.

## Provenance

Generated or inferred node proposals must include provenance unless the operation-specific semantic validator says otherwise.

```json
{
  "source_type": "planner_inference",
  "source_reference": "planning/intake/refined-brief.md#open-questions",
  "created_by": "theplanner propose",
  "confidence": "medium"
}
```

Allowed `source_type` values are `user_answer`, `planner_inference`, `repo_scan`, `adr`, `document_projection`, and `manual_edit`. Allowed `confidence` values are `low`, `medium`, and `high`.

## Approval Behavior

Schema validation only checks that an approval classification has the right shape when supplied. Candidate application decides whether approval is required.

Approval-required examples include:

- Accepted Decisions, which require `approval_classification`.
- Dependency Edge proposals, because they can change readiness.
- HITL Gate proposals, because they can block readiness.
- Work Item execution-state updates, because they change planning state.

Use `"approved": true` at the proposal top level, or the CLI `--approved` flag, before applying approval-required operations.

## Operation Shapes

See deterministic examples in `examples/proposed-graph-operations/`:

- Open Question: `add-open-question.json`
- Requirement: `add-requirement.json`
- Decision: `add-decision.json`
- Work Item: `add-work-item.json`
- Dependency Edge: `add-dependency-edge.json`
- HITL Gate: `add-hitl-gate.json`
- Work Item execution-state update: `update-work-item-execution-state.json`

Malformed examples in the same directory are expected to fail the proposal schema and are covered by tests.

## Proposal Validation vs Graph Validation

Proposal schema validation answers: "Is this operation JSON well-formed and supported?"

Planning Graph validation answers: "Is the resulting graph valid, internally consistent, and ready to save?"

The proposal schema must not replace `planning/graph.schema.json`. Proposal validation runs first, candidate graph application deep-clones the canonical graph, and the final candidate still goes through Planning Graph validation before any apply path can write `planning/graph.json`.
