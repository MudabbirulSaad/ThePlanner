# Refined Brief

## Product Summary

Build a local-first todo application for people who need a fast daily task list without an account.

## Users

- Individual knowledge workers managing daily tasks.

## Goals

- Let users capture, organize, and complete todos quickly.
- Keep the MVP usable without network access.

## MVP Scope

- Users can add a todo with required text and optional notes.
- Users can edit todo text and notes.
- Users can mark todos complete or active.
- Users can filter todos by all, active, and completed.
- Todos persist locally between app launches.

## Non-Goals

- Do not add team sharing.
- Do not add cloud sync.

## Constraints

- Use a frontend UI backed by local storage.
- Keep behavior deterministic and covered by npm test.
- Risk: browser storage limits may require a future migration path.

## Success Criteria

- A user can manage a list of todos across reloads.
- npm test passes for todo creation, editing, completion, filtering, and persistence.

## Decisions

- Accepted: Use local storage for MVP persistence. Rationale: Avoids account and backend scope for the first release. Alternatives: hosted database, file export.

## Open Questions

- Which empty-state illustration should be used? Blocks execution: no
