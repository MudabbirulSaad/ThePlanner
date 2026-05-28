---
id: wi-002
title: Implement core graph types and stable IDs
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: [wi-001]
blocks: [wi-003, wi-004]
requirements: [req-001]
decisions: [dec-001, dec-003, dec-004]
components: [comp-001]
risks: []
hitl_gates: []
validation:
  - type: command
    command: npm test
    expected_result: Graph model unit tests pass
rollback: If model tests fail, preserve failing cases and report changed files.
---

# Implement core graph types and stable IDs

## Context

The Planning Graph is canonical and needs typed V1 nodes, edges, stable IDs, graph versioning, and archive metadata.

## Desired Outcome

Implement core TypeScript types for graph nodes, edges, work items, readiness snapshots, provenance, and stable IDs.

## Boundaries / Non-goals

Do not import adapters, filesystem, Git, LLM provider, Repo Scan, or schema adapter code from `src/core/**`.

## Acceptance Criteria

- Core defines V1 node and edge types
- Stable typed IDs are modeled
- Archived node metadata is represented

## Validation

Run `npm test`; graph model unit tests should pass.

## Dependencies

Complete in `slice-001`.

## HITL Gates

None.

## Agent Notes

Prefer discriminated unions or equivalent strongly typed structures for V1 node kinds.
