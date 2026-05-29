# Issue 017: Production Hardening Audit

## Goal

Audit the planner after intake, graph creation, agent execution, and packaging exist, then identify the smallest remaining production-readiness gaps.

## User Story

As a maintainer, I want a production hardening review, so the project can move from local alpha/beta to reliable production use.

## Scope

- Review:
  - command UX
  - failure modes
  - destructive operations
  - schema/migration behavior
  - run artifacts
  - agent process boundaries
  - config loading
  - docs accuracy
  - test coverage
  - security risks
- Produce a short hardening report in `docs/`.
- Fix only small correctness/documentation issues found during the review.
- Create follow-up issue files for larger work.

## Non-Goals

- Do not start broad rewrites.
- Do not add new product features during the audit.
- Do not hide known limitations.

## Implementation Notes

- Take a code-review stance: findings first, by severity.
- Preserve unrelated user changes.
- Keep validation evidence in the report.

## Acceptance Criteria

- A hardening report exists under `docs/`.
- Any small fixes have tests or clear validation.
- Larger issues are captured as new issue files.
- Full validation passes or failures are documented with smallest next fix.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
node dist/src/adapters/cli/index.js status --json
node dist/src/adapters/cli/index.js validate --json
node dist/src/adapters/cli/index.js reconcile --json
```

## Completion

When complete, move this file to:

```text
issues/done/017-production-hardening-audit.md
```

