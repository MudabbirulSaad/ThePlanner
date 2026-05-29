# Refined Brief

Source idea: planning/intake/idea.md

## Product Summary

Build a CLI-first AI Engineering Planner that turns a refined brief into a repository-native Planning Graph.

## Users

- Solo maintainers and engineering leads planning agent-assisted software work.

## Goals

- Produce deterministic local planning artifacts that can be reviewed in Git.
- Keep graph validation and readiness labels explicit before any coding agent runs.

## MVP Scope

- Support a planner CLI dry run that reads a refined brief and proposes a valid Planning Graph.
- Include requirements, Work Items, execution slices, dependency views, and document projection nodes.

## Non-Goals

- Do not call live LLM providers.
- Do not sync external trackers.

## Constraints

- Core graph logic must remain pure TypeScript domain code without filesystem access.
- Risk: inferred plans may be too coarse when the brief leaves implementation detail unknown.

## Success Criteria

- The dry run prints deterministic JSON and does not mutate repository files.

## Open Questions

- Which fields should require human approval before apply?
- How should future apply mode protect an existing graph?
