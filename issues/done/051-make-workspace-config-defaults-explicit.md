# Issue 051: Make Workspace Config Defaults Explicit

## Type

AFK

## Complexity

Low

## Primary User Effort

Low

## Goal

Make `planner.config.json` behavior explicit during workspace initialization and config loading.

## User Story

As a Primary User, I want to know whether ThePlanner is using a real config file or virtual defaults, so workspace setup is predictable and reproducible.

## Scope

- Update initialization or status/reporting behavior so missing `planner.config.json` is not silent.
- Either create a default `planner.config.json` during `init`, or clearly report that default config is virtual and show the effective defaults.
- Preserve existing user-authored config files without overwriting them.
- Add tests for missing config, existing config, and custom planning directory behavior.

## Non-Goals

- Do not add interactive config prompts.
- Do not change the default config values unless required for serialization.
- Do not add external tracker configuration.
- Do not change Planning Graph schema.

## Implementation Notes

- The visible run reported an initialized workspace while the CLI silently used default config.
- Keep config parsing in application code and filesystem behavior in adapters.
- If writing a default config, use stable formatting and deterministic key order.

## Acceptance Criteria

- A fresh `init` makes config behavior visible to the Primary User.
- Existing `planner.config.json` is not overwritten.
- Loading defaults remains supported for backward compatibility.
- Tests prove missing config, existing config, and non-default `planningDirectory` behavior.

## Blocked by

None - can start immediately.

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
issues/done/051-make-workspace-config-defaults-explicit.md
```
