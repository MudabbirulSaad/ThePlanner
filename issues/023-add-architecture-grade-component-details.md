# Issue 023: Add Architecture Grade Component Details

## Goal

Make Component nodes useful enough to drive an architecture Document Projection and agent handoff context.

## User Story

As a Primary User, I want the Planning Graph to capture component responsibilities, interfaces, dependencies, constraints, and risks, so architecture output is specific enough to guide implementation.

## Scope

- Extend Component representation to include implementation-relevant architecture details.
- Parse obvious architecture/component details from refined briefs when planning from a brief.
- Preserve component details through graph JSON parse/serialize.
- Validate that component references from Work Items and document projections remain safe and meaningful.
- Add tests for graph parsing, planning from brief, and projection rendering impacts.

## Non-Goals

- Do not perform repository source-code scanning in this issue.
- Do not generate full C4 diagrams or image assets.
- Do not introduce live provider calls.

## Implementation Notes

- Keep fields small and typed. Avoid one large unstructured architecture blob.
- Component details should improve both architecture docs and agent context bundles later.

## Acceptance Criteria

- A refined brief with architecture/component details creates Component nodes with more than a title and responsibility.
- Graph serialization round-trips the new component details.
- Validation catches malformed component relationships where appropriate.
- Existing example graphs are updated or compatibility is preserved intentionally.

## Blocked by

- None - can start immediately

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
issues/done/023-add-architecture-grade-component-details.md
```
