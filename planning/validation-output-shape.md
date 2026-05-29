# Graph Validation Output Shape

V1 Graph Validation combines JSON Schema validation with semantic planning validation.

## JSON Shape

```json
{
  "graphVersion": 2,
  "status": "warning",
  "schemaStatus": "pass",
  "schemaErrors": [],
  "semanticErrors": [],
  "semanticWarnings": [
    {
      "code": "HITL_GATE_BLOCKS_INITIAL_WORK",
      "message": "Initial Work Items are HITL-gated until generated artifacts are approved.",
      "nodeId": "wi-001"
    }
  ],
  "readinessSummary": {
    "afkReady": [],
    "agentEligible": ["wi-001", "wi-002", "wi-003", "wi-004", "wi-005", "wi-006", "wi-007", "wi-008"],
    "hitlGated": ["wi-001", "wi-002", "wi-003", "wi-004", "wi-005", "wi-006", "wi-007", "wi-008"],
    "blocked": [],
    "humanOnly": []
  }
}
```

## Rules

- Schema errors are reported in `schemaErrors`, produce a non-zero exit code, and skip semantic validation.
- Semantic validation errors block AFK-ready labels and unsafe exports.
- Warnings may export but must remain visible.
- Every AFK-ready Work Item must have traceability, Acceptance Criteria, Validation Method, clear dependencies, and no unresolved HITL Gate.
- Every Blocker must include a cause link.
