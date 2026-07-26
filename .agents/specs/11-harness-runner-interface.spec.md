---
id: harness-runner-interface
title: Pluggable Harness Runner Interface Abstraction
version: 1.0.0
status: completed
createdAt: "2026-07-25T20:47:30Z"
updatedAt: "2026-07-25T20:47:30Z"
author: jpolvora
domain: harness-execution
type: feature
slug: 11-harness-runner-interface
source: local
---

# Harness Runner Interface Abstraction Specification

## 1. Executive Summary

`cursor-server` currently relies solely on local `@cursor/sdk` calls inside `src/services/agent-runner.ts`. To fulfill the roadmap requirement of supporting pluggable execution harnesses (Cursor SDK, Hermes Agent, OpenCode, or custom runner adapters) across spec pipeline stages (`spec` -> `implement` -> `build` -> `test` -> `deploy` -> `review`), this feature establishes a clean, pluggable `HarnessRunner` interface, standard stage result/execution contracts, and a central `RunnerRegistry`.

## 2. Requirements & Acceptance Criteria

### Requirement 1: Harness Runner Interface & Stage Contracts (`src/services/harness-runner.ts`)
- Define `HarnessStage` type: `'spec' | 'implement' | 'build' | 'test' | 'deploy' | 'review'`.
- Define `StageInput`: `{ stage: HarnessStage; repoPath: string; prompt: string; options?: Record<string, unknown> }`.
- Define `StageOutput`: `{ stage: HarnessStage; status: 'success' | 'failed' | 'error'; durationMs: number; logs: string[]; artifacts?: string[]; error?: string; rawResult?: unknown }`.
- Define `HarnessRunner` interface:
  - `id: string`
  - `name: string`
  - `supportedStages: HarnessStage[]`
  - `executeStage(input: StageInput): Promise<StageOutput>`
  - `healthCheck(): Promise<{ healthy: boolean; details?: string }>`

### Requirement 2: Default `LocalCursorRunner` Implementation
- Create `LocalCursorRunner` implementing `HarnessRunner` (`id: 'cursor-local'`).
- Supported stages: `['spec', 'implement', 'build', 'test', 'review']`.
- Wraps `@cursor/sdk` local agent execution (delegating to or adapting `agent-runner.ts`).
- Returns standardized `StageOutput`.

### Requirement 3: Harness Runner Registry
- Implement `RunnerRegistry` class / service to register, list, and resolve runner instances by ID.
- Provide a default singleton instance `runnerRegistry`.
- Support setting/getting a default runner (defaults to `'cursor-local'`).
- If an requested runner ID is missing, throws or falls back safely to default runner according to configuration.

### Requirement 4: Test Coverage (`src/services/harness-runner.test.ts`)
- Verify `LocalCursorRunner` registration and retrieval via `runnerRegistry`.
- Test fallback behavior when resolving unregistered runner IDs.
- Test `executeStage` contract normalization and error handling.
- Ensure 100% type safety and passing build/typecheck.

## 3. Architecture & Data Structures

```typescript
export type HarnessStage = 'spec' | 'implement' | 'build' | 'test' | 'deploy' | 'review';

export interface StageInput {
  stage: HarnessStage;
  repoPath: string;
  prompt: string;
  options?: Record<string, unknown>;
}

export interface StageOutput {
  stage: HarnessStage;
  status: 'success' | 'failed' | 'error';
  durationMs: number;
  logs: string[];
  artifacts?: string[];
  error?: string;
  rawResult?: unknown;
}

export interface HarnessRunner {
  id: string;
  name: string;
  supportedStages: HarnessStage[];
  executeStage(input: StageInput): Promise<StageOutput>;
  healthCheck(): Promise<{ healthy: boolean; details?: string }>;
}
```

## 4. Verification Plan

1. Run `npm run typecheck` to verify TypeScript types compile cleanly.
2. Run `npm run test` (or `npx tsx src/services/harness-runner.test.ts`) to verify registry registration, resolution, fallback, and stage execution contract behavior.
3. Run `npm run build` to ensure production build succeeds.
