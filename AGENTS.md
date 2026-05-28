# Repository Guidelines

## Project Structure & Module Organization

This repository is the AI Engineering Planner: a CLI-first TypeScript/Node tool that turns an Intake Brief into a Planning Graph, projections, Work Items, dependency views, and readiness labels. Use Hexagonal Architecture from the start:

- `src/core/`: pure domain logic for graph types, validation, readiness, projection rendering, reconciliation, and shared types.
- `src/application/`: use cases and ports for graph storage, projection IO, CLI orchestration, and change-log writing.
- `src/adapters/`: CLI and filesystem adapter implementations.
- `tests/core/`, `tests/application/`, `tests/fixtures/`, `tests/golden/`, `tests/integration/`: domain tests, use-case tests, fixtures, expected artifact outputs, CLI integration tests, and dependency-boundary checks.

## Build, Test, and Development Commands

Expected package scripts:

- `npm run build`: compile TypeScript with `tsc -p tsconfig.json`.
- `npm test`: run `vitest run`.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run lint`: run ESLint, including dependency-boundary checks.
- `npm run format`: format with Prettier.
- `npm run check`: run build, tests, and lint.
- `npm run validate:graph`: run the built CLI validation command, `node dist/src/adapters/cli/index.js validate`.

## Coding Style & Naming Conventions

Use TypeScript with strict types for graph nodes, edges, readiness snapshots, projections, and graph operations. Prefer `camelCase` for variables/functions, `PascalCase` for types/classes, and `kebab-case` for Markdown filenames. CLI command names and generated file paths must be deterministic.

## Architecture Rules

`src/core/**` must not import CLI, filesystem, Git, LLM provider, Repo Scan, schema adapters, or other infrastructure. `src/application/**` orchestrates use cases through ports. `src/adapters/**` implements ports. CLI code calls application use cases, not core internals.

## Testing Guidelines

Test core domain behavior heavily: graph model, dependency edges, Graph Validation, readiness derivation, and approval rules. Test adapters narrowly with fakes or fixtures. Use golden-file integration tests for CLI commands and generated artifacts. LLM adapter tests must not call live providers. AFK-ready derivation needs regression tests for every blocking condition.

## Commit & Pull Request Guidelines

This directory has no Git history available, so no existing commit convention can be inferred. Use short imperative commit messages, such as `Add graph validation rules`. Pull requests should include scope, linked issue or Work Item, validation evidence, and screenshots or artifact diffs when outputs change.
