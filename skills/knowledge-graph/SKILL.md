---
name: knowledge-graph
description: Manage persistent Knowledge Graph for specifications. Provides read, query, update, and validation capabilities for codebase analysis caching. Use when: spec-to-tasks needs to cache/reuse codebase analysis, task-implementation needs to validate task dependencies or contracts, spec-quality needs to synchronize provides, or any command needs to query existing patterns/components/APIs. Reduces redundant codebase exploration by caching agent discoveries.
license: MIT
---
# Knowledge Graph Skill

## Overview

The Knowledge Graph (KG) is a persistent JSON file that stores discoveries from codebase analysis, eliminating redundant exploration and enabling task validation.

**Location**: `docs/specs/[ID-feature]/knowledge-graph.json`

Load reference files as needed (schema, query-examples, integration-patterns, error-handling, performance, security, examples).

See bundled `references/*` for operations, schema, and integration patterns. Source-code safe: only creates/updates `knowledge-graph.json` under `docs/specs/[ID]-`.