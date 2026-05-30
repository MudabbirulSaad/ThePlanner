# Issue 024: Render Real Architecture Projection

## Goal

Upgrade the architecture Document Projection from a component list into an implementation-guiding architecture note.

## User Story

As a Primary User, I want `docs/architecture/*.md` to explain system shape, component responsibilities, dependencies, constraints, risks, and Work Item links, so agents and humans share the same implementation context.

## Scope

- Render architecture sections for overview, components, interfaces/contracts, dependency notes, constraints, risks, open questions, and Work Item traceability.
- Keep the architecture projection deterministic and generated from graph state.
- Add golden or integration coverage for the generated architecture Markdown.
- Ensure agent context bundle selection can include the richer architecture projection without special cases.

## Non-Goals

- Do not create diagrams.
- Do not call live LLM providers.
- Do not make architecture Markdown canonical.

## Implementation Notes

- This issue is blocked by Issue 023 if it needs richer Component fields.
- Keep sections useful even when some graph fields are absent by rendering explicit `None` or scaffold text.

## Acceptance Criteria

- Exporting projections produces an architecture document with useful implementation guidance.
- The document includes graph IDs and Work Item links where relevant.
- Output remains deterministic across repeated exports.
- Tests cover a realistic graph with multiple components and dependency edges.

## Blocked by

- Issue 023: Add Architecture Grade Component Details

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
```

## Completion

When complete, move this file to:

```text
issues/done/024-render-real-architecture-projection.md
```
