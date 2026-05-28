# Hexagonal Architecture for Core Planner

The AI Engineering Planner uses Hexagonal Architecture. The core planner domain is independent from CLI commands, filesystem writes, Git operations, LLM providers, Repo Scan, JSON Schema validation adapters, and future web/editor/tracker integrations. This is hard to reverse because it shapes module boundaries, testing strategy, provider integration, CLI design, and future interfaces. It trades more upfront structure for cleaner testing, reusable core logic, and easier expansion beyond the CLI-first MVP.
