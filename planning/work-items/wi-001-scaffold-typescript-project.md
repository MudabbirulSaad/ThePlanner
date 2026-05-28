---
id: wi-001
title: Scaffold TypeScript project and package scripts
graph_version: 6
execution_state: done
readiness: [agent_eligible, afk_ready]
depends_on: []
blocks: [wi-002, wi-008]
requirements: [req-006]
decisions: [dec-003, dec-004]
components: [comp-003]
risks: []
hitl_gates: []
validation:
  - type: command
    command: npm run build
    expected_result: TypeScript compiles without errors after scaffold code exists
rollback: Preserve changed files and report failing command; do not delete unrelated files.
---

# Scaffold TypeScript project and package scripts

## Context

V1 uses TypeScript/Node with a CLI-first interface and reusable core library.

## Desired Outcome

Create the initial Node/TypeScript project foundation with accepted package scripts and local `planner` binary wiring.

## Boundaries / Non-goals

Do not implement graph validation or CLI behavior beyond scaffold wiring.

## Acceptance Criteria

- package.json defines accepted scripts
- tsconfig and source directories exist
- planner binary is declared for local development

## Validation

Run `npm run build`; it should compile after scaffold code exists.

## Dependencies

Complete in `slice-001`.

## HITL Gates

None.

## Agent Notes

Keep source layout aligned with Hexagonal Architecture.
