# Issue 003: Add Intake Brief Template And Grilling Questions

## Goal

Make raw idea capture explicit by adding an intake brief model/template and deterministic grilling questions.

## User Story

As a user, I want to write a rough idea and receive structured questions, so the idea can be refined before graph generation.

## Scope

- Add an intake brief template under `src/templates/` or another existing template boundary.
- Add a command such as:

```sh
planner intake questions --from planning/intake/idea.md --json
```

- The command should read the idea file and output deterministic questions grouped by:
  - target user
  - problem
  - MVP scope
  - non-goals
  - constraints
  - success criteria
  - risks/open questions
- Add a high-level human-readable output mode.
- Add tests using fixture idea files.

## Non-Goals

- Do not call an LLM.
- Do not ask interactive questions yet unless `--interactive` already exists and is explicitly passed.
- Do not create `planning/graph.json` in this issue.

## Implementation Notes

- This can be rule-based and deterministic.
- Keep the output useful enough to paste into a fresh agent session for a real grilling conversation.
- Avoid pretending the deterministic questions are a full planner.

## Acceptance Criteria

- Given a short `idea.md`, the command returns a stable list of refinement questions.
- Missing idea files produce a useful error.
- Tests cover command output and missing file behavior.
- Documentation explains how to use the output with Codex/Claude/Gemini manually.

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
issues/done/003-intake-brief-template-and-grilling-questions.md
```

