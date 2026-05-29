---
id: doc-003
projection_type: architecture
graph_version: 6
source_graph: planning/graph.json
---

# AI Engineering Planner V1 Architecture

## Components

- comp-001: Core Domain
- comp-002: Application Use Cases
- comp-003: CLI Adapter
- comp-004: Filesystem Export Adapter
- comp-005: Schema Adapter
- comp-006: LLM Adapter
- comp-007: Repo Scan Adapter

## Architecture Boundary

Core remains independent from CLI and infrastructure adapters.
