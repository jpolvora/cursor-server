# Execution Plan & Task DAG — Pluggable Harness Runner Interface Abstraction

## Workflow Configuration
- Exec Mode: `sequential`
- Total Implementation Tasks: 2

## Task List

### Task 1: Create `src/services/harness-runner.ts`
- Implement types: `HarnessStage`, `StageInput`, `StageOutput`, `HarnessRunner`.
- Implement `LocalCursorRunner` class wrapping `runTask` / `@cursor/sdk`.
- Implement `RunnerRegistry` class and export `runnerRegistry` singleton pre-populated with `LocalCursorRunner`.

### Task 2: Create `src/services/harness-runner.test.ts`
- Write unit tests verifying registration, lookup, fallback, health checks, and execution output format.
- Run typecheck and unit tests to verify implementation.
