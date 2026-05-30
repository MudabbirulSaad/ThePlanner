---
id: doc-001
projection_type: prd
graph_version: 6
source_graph: planning/graph.json
---

# AI Engineering Planner V1 PRD

## Product Summary

ThePlanner is a CLI-first planning tool that turns a refined intake brief into a canonical Planning Graph and deterministic repository-native planning artifacts.

## Target Users

- Primary users who want to plan engineering work before implementation
- Human engineers reviewing scoped Work Items
- Coding agents consuming deterministic execution context

## Goals

- Keep the Planning Graph as the source of truth for requirements, decisions, dependencies, and readiness
- Render reviewable Markdown projections for PRDs, RFCs, architecture notes, Work Items, and dependency views
- Support safe export, validation, reconciliation, and agent handoff workflows

## MVP Scope

- Create and validate a typed Planning Graph
- Render deterministic projections into repository paths
- Prepare and run local coding-agent handoffs with bounded validation

## Non-goals

- Live LLM planning or provider calls during deterministic graph operations
- Treating Markdown projections as canonical planning state
- Full external tracker synchronization beyond dry-run previews

## Constraints

- Core domain logic must not import CLI, filesystem, process, schema, tracker, or other adapter code
- CLI commands must be deterministic and pipeline-friendly
- Projection paths must remain stable and workspace-confined

## Requirements

- req-001 (functional, active): Create a canonical Planning Graph. The planner must transform an Intake Brief into a typed Planning Graph that is the source of truth for generated artifacts. Trace: `wi-002`, `wi-007`.
- req-002 (functional, active): Export repository planning artifacts. The planner must export PRD, RFC, architecture, Work Item, dependency, graph, schema, and validation artifacts into predictable repository paths. Trace: `wi-004`.
- req-003 (functional, active): Derive AFK and HITL readiness. The planner must derive readiness labels from graph inputs and explain why Work Items are AFK-ready, agent-eligible, human-only, HITL-gated, or blocked. Trace: `wi-003`.
- req-004 (functional, active): Support graph reconciliation. The planner must detect edits to exported artifacts and propose safe graph patches or artifact regeneration. Trace: `wi-006`, `wi-007`.
- req-005 (constraint, active): Keep the core independent. The core planner must not depend on CLI, filesystem, Git, LLM provider, Repo Scan, or schema adapters. Trace: `wi-008`.
- req-006 (functional, active): Expose an agent-invocable CLI. The CLI must support pipeline-friendly commands with JSON output, deterministic paths, non-zero validation exits, and no prompts unless interactive mode is requested. Trace: `wi-001`, `wi-005`.

## Success Criteria

- A user can generate, validate, export, and review planning artifacts from a graph without manual rewriting
- Work Items include dependencies, validation methods, readiness labels, and traceable requirement links
- Dry-run and apply commands report deterministic JSON results

## Assumptions

- asm-001 (high confidence): Initial implementation will start from an empty repository. The repo currently has documentation artifacts but no TypeScript source tree or package manifest. Impact if wrong: Generated Work Items may miss existing implementation constraints. Does not block AFK.

## Open Questions

- oq-001 (low priority): Should the public command remain planner or use a distinctive name such as engplanner or specforge? Does not block execution.

## Risks

- risk-001 (medium likelihood, medium impact): Schema minutiae could delay the planning loop. Mitigation: Keep the schema draft structural and validate deeper semantics through planned Work Items. Does not block AFK.
- risk-002 (medium likelihood, high impact): Core may accidentally depend on adapters. Mitigation: Add tests or lint rules that fail when src/core imports adapter infrastructure. Blocks AFK.

## Work Item Traceability

- wi-001: Scaffold TypeScript project and package scripts. Requirements: `req-006`. Readiness: agent_eligible, afk_ready. Depends on: none.
- wi-002: Implement core graph types and stable IDs. Requirements: `req-001`. Readiness: agent_eligible, afk_ready. Depends on: `wi-001`.
- wi-003: Implement graph validation and readiness derivation. Requirements: `req-003`. Readiness: agent_eligible, afk_ready. Depends on: `wi-002`.
- wi-004: Implement projection rendering. Requirements: `req-002`. Readiness: agent_eligible, afk_ready. Depends on: `wi-002`.
- wi-005: Implement CLI command surface. Requirements: `req-006`. Readiness: agent_eligible, afk_ready. Depends on: `wi-003`.
- wi-006: Implement graph reconciliation workflow. Requirements: `req-004`. Readiness: agent_eligible, afk_ready. Depends on: `wi-004`.
- wi-007: Implement planning change log. Requirements: `req-001`, `req-004`. Readiness: agent_eligible, afk_ready. Depends on: `wi-005`.
- wi-008: Add dependency-boundary tests. Requirements: `req-005`. Readiness: agent_eligible, afk_ready. Depends on: none.

## Scaffold Notes

- None
