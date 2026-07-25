# Implementation Plan — Pluggable Harness Runner Interface Abstraction

## 1. Goal Description

Introduce a pluggable harness runner interface (`HarnessRunner`) abstraction, along with standardized stage inputs (`StageInput`) and stage outputs (`StageOutput`), a `LocalCursorRunner` implementation wrapping local Cursor SDK runs, and a `RunnerRegistry` service for runner lookup, default fallback, and runtime registration.

## 2. File Changes Overview

### New Files
- `src/services/harness-runner.ts`: Defines `HarnessStage`, `StageInput`, `StageOutput`, `HarnessRunner` interface, `LocalCursorRunner` class, `RunnerRegistry` class, and singleton `runnerRegistry`.
- `src/services/harness-runner.test.ts`: Unit tests for `HarnessRunner` interface compliance, `LocalCursorRunner`, and `RunnerRegistry` functionality.

### Modified Files
- `src/index.ts` (if exposing or registering default runners at startup if necessary, though singleton `runnerRegistry` self-registers `LocalCursorRunner`).

## 3. Detailed Component Plan

### `src/services/harness-runner.ts`
1. Export `HarnessStage`: `'spec' | 'implement' | 'build' | 'test' | 'deploy' | 'review'`.
2. Export `StageInput`:
   ```typescript
   export interface StageInput {
     stage: HarnessStage;
     repoPath: string;
     prompt: string;
     options?: Record<string, unknown>;
   }
   ```
3. Export `StageOutput`:
   ```typescript
   export interface StageOutput {
     stage: HarnessStage;
     status: 'success' | 'failed' | 'error';
     durationMs: number;
     logs: string[];
     artifacts?: string[];
     error?: string;
     rawResult?: unknown;
   }
   ```
4. Export `HarnessRunner`:
   ```typescript
   export interface HarnessRunner {
     id: string;
     name: string;
     supportedStages: HarnessStage[];
     executeStage(input: StageInput): Promise<StageOutput>;
     healthCheck(): Promise<{ healthy: boolean; details?: string }>;
   }
   ```
5. Implement `LocalCursorRunner` implementing `HarnessRunner`:
   - `id = 'cursor-local'`
   - `name = 'Local Cursor SDK Runner'`
   - `supportedStages = ['spec', 'implement', 'build', 'test', 'review']`
   - `executeStage(input: StageInput)` delegates to `runTask` from `./agent-runner.js` when applicable or returns structured `StageOutput`.
   - `healthCheck()` checks presence of `CURSOR_API_KEY` or returns `{ healthy: true }`.
6. Implement `RunnerRegistry`:
   - `register(runner: HarnessRunner): void`
   - `unregister(id: string): boolean`
   - `get(id: string): HarnessRunner | undefined`
   - `getOrDefault(id?: string): HarnessRunner`
   - `list(): HarnessRunner[]`
   - `setDefault(id: string): void`
7. Instantiate and export default singleton `runnerRegistry`.

### `src/services/harness-runner.test.ts`
1. Test `runnerRegistry` has `'cursor-local'` registered by default.
2. Test `register` adds a mock runner (`'mock-hermes'` / `'mock-opencode'`).
3. Test `getOrDefault` resolves valid runner and falls back when given an unknown ID.
4. Test `executeStage` returns expected `StageOutput` format and measures duration.
5. Test `healthCheck` on default runner.

## 4. Verification Plan

### Automated Verification
- `npm run typecheck`
- `npx tsx src/services/harness-runner.test.ts`
- `npm run build`
