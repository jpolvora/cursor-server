---
id: 13-runner-cursor-sdk
title: Cursor SDK Runner Adapter
slug: 13-runner-cursor-sdk
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Cursor SDK Runner Adapter

## Description
Implement a production-ready `CursorSdkRunner` adapter adhering to the `HarnessRunner` interface. The adapter bridges `@cursor/sdk` agent tasks (`Agent.create`, `send`, `run.wait`) into stage-specific execution handlers (`spec`, `implement`, `build`, `test`, `review`). It configures specialized system prompts, agent roles (`planner`, `implementer`, `plan+implementer`), and execution settings per stage while handling graceful cleanup, timeout enforcement, and error normalization.

---

## Acceptance Criteria

### AC1: Stage-Specific Cursor Agent Execution
- **Given** a `StageInput` for any supported stage (`spec`, `implement`, `build`, `test`, `review`),
- **When** `CursorSdkRunner.executeStage(input)` is invoked,
- **Then** it creates a dedicated local Cursor agent instance configured with stage-tailored role prompts, model settings, and execution bounds.

### AC2: Standardized Stage Output & Artifact Extraction
- **Given** a Cursor SDK execution finishes,
- **When** results are returned,
- **Then** `CursorSdkRunner` converts raw SDK output into a normalized `StageOutput` containing logs, status, duration, and extracted artifacts (such as generated files or plan reports).

### AC3: Robust Resource Disposal & Error Handling
- **Given** an unexpected exception or timeout during SDK execution,
- **When** an error occurs,
- **Then** the adapter disposes of the agent runtime via `[Symbol.asyncDispose]()` or `finally` block and returns `status: 'failed'` or `'error'` with diagnostic logs.

---

## Technical Guidance & Architecture
- Extends the baseline `LocalCursorRunner` pattern in `src/services/harness-runner.ts`.
- Implements `HarnessRunner` with `id: 'cursor-sdk'`.
- Registers automatically in `runnerRegistry`.
