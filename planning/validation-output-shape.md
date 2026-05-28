# Graph Validation Output Shape

V1 Graph Validation combines JSON Schema validation with semantic planning validation.

## JSON Shape

```json
{
  "graph_version": 2,
  "status": "warning",
  "schema": {
    "status": "pass",
    "errors": []
  },
  "semantic": {
    "status": "warning",
    "errors": [],
    "warnings": [
      {
        "code": "HITL_GATE_BLOCKS_INITIAL_WORK",
        "message": "Initial Work Items are HITL-gated until generated artifacts are approved.",
        "node_ids": ["hitl-001", "wi-001", "wi-002", "wi-003", "wi-004", "wi-005", "wi-006", "wi-007", "wi-008"]
      }
    ]
  },
  "readiness_summary": {
    "afk_ready": [],
    "agent_eligible": ["wi-001", "wi-002", "wi-003", "wi-004", "wi-005", "wi-006", "wi-007", "wi-008"],
    "hitl_gated": ["wi-001", "wi-002", "wi-003", "wi-004", "wi-005", "wi-006", "wi-007", "wi-008"],
    "blocked": [],
    "human_only": []
  }
}
```

## Rules

- Validation errors block AFK-ready labels and unsafe exports.
- Warnings may export but must remain visible.
- Every AFK-ready Work Item must have traceability, Acceptance Criteria, Validation Method, clear dependencies, and no unresolved HITL Gate.
- Every Blocker must include a cause link.
