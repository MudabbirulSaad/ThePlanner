# Issue 019: Define Schema Version And Migration Policy

## Goal

Make graph schema compatibility deterministic before future graph versions are introduced.

## User Story

As a maintainer, I want explicit schema version handling, so production users get clear validation or migration behavior when graph shape changes.

## Scope

- Define supported `schema_version` values for V1.
- Decide whether unsupported versions fail validation or route through a migration adapter.
- Pin current runtime schema validation to the supported V1 version.
- Document the policy in README or docs.
- Add focused tests for supported and unsupported schema versions.

## Non-Goals

- Do not implement V2 graph behavior.
- Do not add migrations beyond the minimum policy needed for V1.
- Do not change existing valid V1 graph output.

## Acceptance Criteria

- Unsupported schema versions fail with a clear validation error or documented migration-unavailable error.
- Current `schema_version: "0.1.0"` graphs still pass.
- The migration/version policy is documented.

## Validation

```sh
npm run build
npm test
npm run lint
npm run check
npm run validate:graph
```

