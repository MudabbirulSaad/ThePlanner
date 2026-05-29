# Issue 004: Add Refined Brief File Workflow

## Goal

Introduce a repository-native refined brief file that becomes the input to graph planning.

## User Story

As a user, I want a structured refined brief artifact, so the planner has a stable input before creating a Planning Graph.

## Scope

- Add a refined brief schema/model in the application or core boundary as appropriate.
- Add a command such as:

```sh
planner intake refine --from planning/intake/idea.md --out planning/intake/refined-brief.md --json
```

- Without LLM calls, the command may scaffold a refined brief with sections and TODO markers.
- Include sections:
  - product summary
  - users
  - goals
  - MVP scope
  - non-goals
  - constraints
  - success criteria
  - open questions
- Add tests for deterministic file creation and no overwrite unless a force flag is explicitly added.

## Non-Goals

- Do not infer a complete plan.
- Do not create Work Items.
- Do not call live LLMs.

## Implementation Notes

- Treat the refined brief as user-owned Markdown.
- Do not overwrite an existing refined brief unless explicitly requested.
- Keep command output clear about scaffolded/deferred behavior.

## Acceptance Criteria

- The command creates `planning/intake/refined-brief.md` from a raw idea file.
- Existing refined briefs are preserved.
- JSON output reports created/skipped paths.
- Docs describe that the user or an agent should fill the refined brief before planning.

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
issues/done/004-refined-brief-file-workflow.md
```

