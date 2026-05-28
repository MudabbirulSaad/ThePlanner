---
id: wi-008
title: Add dependency-boundary tests
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: []
blocks: []
requirements: [req-005]
decisions: [dec-003]
components: [comp-001]
risks: [risk-002]
hitl_gates: []
validation:
  - type: command
    command: npm run check
    expected_result: Build, tests, and lint pass with boundary checks enabled
rollback: If boundary tests are too broad, narrow them without weakening core isolation.
---

# Add dependency-boundary tests

## Context

Hexagonal Architecture must be enforced so the core does not import infrastructure.

## Desired Outcome

Add tests or lint rules that fail when `src/core/**` imports adapters, CLI, filesystem, Git, LLM, Repo Scan, or schema adapter code.

## Boundaries / Non-goals

Do not block legitimate imports from core shared/domain modules.

## Acceptance Criteria

- Tests fail if src/core imports adapters, CLI, filesystem, Git, LLM, Repo Scan, or schema adapter code
- Boundary tests run in npm test or npm run lint

## Validation

Run `npm run check`; build, tests, and lint should pass.

## Dependencies

Complete in `slice-001`.

## HITL Gates

None.

## Agent Notes

This Work Item mitigates `risk-002`.
