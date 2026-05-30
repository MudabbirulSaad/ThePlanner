---
id: doc-001
projection_type: prd
graph_version: 2
source_graph: planning/graph.json
---

# Repository Planner PRD

## Product Summary

Build a CLI that turns a refined intake brief into reviewable planning artifacts.

## Target Users

- Solo maintainers
- Coding agents

## Goals

- Create a canonical graph
- Export human-reviewable documents

## MVP Scope

- Plan from a refined brief
- Export PRD projections

## Non-goals

- Live LLM calls

## Constraints

- Core stays independent from adapters

## Requirements

- req-001 (functional, active): Export a PRD. The planner must render a product requirements document from graph fields. Trace: `wi-001`.

## Success Criteria

- Dry-run export output is deterministic

## Assumptions

- asm-001 (medium confidence): Markdown review is acceptable. Human reviewers can review generated Markdown directly. Impact if wrong: The workflow needs an editor integration. Does not block AFK.

## Open Questions

- oq-001 (high priority): Which PRD sections are mandatory for review? Blocks execution.

## Risks

- risk-001 (medium likelihood, high impact): Generated docs drift. Mitigation: Keep the Planning Graph canonical and regenerate projections. Blocks AFK.

## Work Item Traceability

- wi-001: Render PRD projection. Requirements: `req-001`. Readiness: agent_eligible, afk_ready. Depends on: none.

## Scaffold Notes

- Confirm rollout guidance before implementation.
