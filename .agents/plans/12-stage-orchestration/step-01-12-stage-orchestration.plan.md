---
slug: 12-stage-orchestration
title: "Stage Pipeline Orchestration & Observability Service"
status: "plan to be refined"
---

## 0. Summary & Business Rules
Implement the core `StageOrchestrator` engine and observability API endpoints for `cursor-server`. The engine executes machine-actionable qualified specs (parsed via `QualifiedSpec` from `src/services/spec-schema.ts`) sequentially across defined pipeline stages (`spec` → `implement` → `build` → `test` → `deploy` → `review`). It uses registered `HarnessRunner` implementations (from `src/services/harness-runner.ts`), records per-stage execution metadata & logs, persists pipeline run state, supports run resumability starting from failed stages, and exposes HTTP API endpoints for run management.

Business Rules:
- Stages are executed sequentially in order defined by `spec.stages` (default `spec` → `implement` → `build` → `test` → `deploy` → `review`).
- Stage execution fails fast: if any stage fails or errors, subsequent stages are skipped and the run status becomes `failed` or `error`.
- Resumability: calling `resume(runId)` skips already completed/successful stages and restarts execution at the first incomplete/failed stage.
- Persistence: run state and per-stage outputs are persisted to disk via a dedicated store (`stageStore` or `StageStore`).
- Async API: `POST /harness/runs` and `POST /harness/runs/:runId/resume` respond with `202 Accepted` and dispatch pipeline execution asynchronously.

## 1. Definition of Ready & Scope
Acceptance Criteria:
- **AC1: Sequential Stage Pipeline Execution**: `StageOrchestrator.run(spec, repoPath, options)` executes stages sequentially using the configured `HarnessRunner`.
- **AC2: Per-Stage Observability & Artifact Tracking**: Per-stage execution metadata (`stage`, `status`, `durationMs`, stdout/stderr logs, output artifacts, errors) recorded into pipeline run state.
- **AC3: Resumability & Checkpointing**: `StageOrchestrator.resume(runId)` resumes from the failed stage without re-running earlier successful stages.
- **AC4: Stage Orchestration API Endpoints**: `POST /harness/runs` (trigger), `POST /harness/runs/:runId/resume` (resume), and `GET /harness/runs/:runId` (status query).

Out of Scope:
- UI editor / visual pipeline graph builder (Phase 4 item).
- Multi-tenant cloud sandbox execution (Phase 5 item).

## 2. Technical Design & Architecture

### Component Edits & Additions

#### `[NEW]` [stage-orchestrator.ts](file:///l:/source/cursor-server/src/services/stage-orchestrator.ts)
Core engine service managing pipeline runs:
- `StageOrchestrator`:
  - `run(spec: QualifiedSpec, repoPath: string, options?: StageRunOptions): Promise<PipelineRunRecord>`
  - `runAsync(spec: QualifiedSpec, repoPath: string, options?: StageRunOptions): PipelineRunRecord` (creates queued record and starts execution in background)
  - `resume(runId: string): Promise<PipelineRunRecord>`
  - `resumeAsync(runId: string): PipelineRunRecord`
- Types & interfaces: `PipelineRunRecord`, `PipelineStageRecord`, `StageRunOptions`.

#### `[NEW]` [stage-store.ts](file:///l:/source/cursor-server/src/services/stage-store.ts)
Persistence store for pipeline run records:
- Storage path: `{reposRoot}/.stage-runs.json`.
- Methods: `createRun`, `getRun`, `updateRun`, `listRuns`, `saveToDisk`, `loadFromDisk`.

#### `[NEW]` [harness.ts](file:///l:/source/cursor-server/src/routes/harness.ts)
HTTP API router for harness and stage orchestration:
- `POST /harness/runs`: Accept spec (payload or spec file reference/ID) + repo + runnerId -> returns `202 Accepted` with `runId`.
- `POST /harness/runs/:runId/resume`: Resumes failed run -> returns `202 Accepted` with `runId`.
- `GET /harness/runs/:runId`: Query pipeline run details and per-stage outputs.
- `GET /harness/runners`: List registered harness runners (helper route).

#### `[MODIFY]` [index.ts](file:///l:/source/cursor-server/src/index.ts)
- Mount `harnessRoutes` at `/harness`.
- Initialize `stageStore` during app startup.

#### `[NEW]` [stage-orchestrator.test.ts](file:///l:/source/cursor-server/src/services/stage-orchestrator.test.ts)
Unit & integration tests for stage orchestrator execution, stage logging, resumability, and failure handling.

#### `[NEW]` [harness.test.ts](file:///l:/source/cursor-server/src/routes/harness.test.ts)
Integration tests for `/harness/runs`, `/harness/runs/:runId`, and `/harness/runs/:runId/resume` endpoints.

## 3. Step-by-Step Plan

1. **Stage Run Store (`stage-store.ts`)**:
   - Define `PipelineRunRecord`, `PipelineStageRecord`, and status types.
   - Implement `StageStore` class with file persistence to `.stage-runs.json`.
   - Add unit/store initialization.

2. **Stage Orchestrator Core (`stage-orchestrator.ts`)**:
   - Implement `StageOrchestrator` using `runnerRegistry` from `harness-runner.ts`.
   - Map qualified spec acceptance criteria to stage prompts/context where appropriate.
   - Implement sequential execution loop through `spec.stages`.
   - Record per-stage status, duration, stdout/stderr logs, artifacts, and errors into `PipelineRunRecord`.
   - Implement resumability in `resume()`: look up run, find first non-successful stage index, skip previous successful stages, and execute remaining stages.

3. **HTTP API Routes (`routes/harness.ts` & `index.ts`)**:
   - Create Hono route handler with Zod schemas for POST payloads.
   - Register endpoints `POST /harness/runs`, `POST /harness/runs/:runId/resume`, `GET /harness/runs/:runId`, `GET /harness/runners`.
   - Wire route in `src/index.ts`.

4. **Testing & Verification**:
   - Create unit tests for `StageOrchestrator` with mock/stub runners.
   - Create integration tests for harness API routes.
   - Run `npm run typecheck` and `npm test` / verification.

## 4. Permissions, Tenancy & i18n
- Homelab / local execution context. Repos stored under `REPOS_ROOT`.
- API endpoints validate request body format using Zod schemas.

## 5. Test Coverage
- **AC1 (Sequential Stage Execution)**: Test that `StageOrchestrator.run()` calls `runner.executeStage()` in exact stage order (`spec` -> `implement` -> `build` -> `test` -> `deploy` -> `review`).
- **AC2 (Observability & Tracking)**: Test that completed run contains stage durations, logs, artifacts, and error messages for failed stages.
- **AC3 (Resumability)**: Test that when run fails at stage `test`, `resume(runId)` skips `spec`, `implement`, `build` and executes from `test`.
- **AC4 (API Endpoints)**: Test HTTP `POST /harness/runs` returns 202 with `runId`, `GET /harness/runs/:runId` returns state, and `POST /harness/runs/:runId/resume` triggers resumption.

## 6. Invariants (Do Not Violate)
- `localSdkRuntimeOnly`: Use local Cursor SDK / local runners.
- `thinRoutesNoBusinessLogic`: Route handlers delegate to services.
- `secretsFromEnvOnly`: No secrets in code.
- `disposeAgentsAlways`: Ensure clean agent and resource handling.

## 7. Pre-PR Checklist
- [x] Layer boundaries respected (`services/` vs `routes/`).
- [x] Schema & validation applied with Zod.
- [x] Resumability logic tested.
- [x] API endpoints return 202 Accepted for async execution.
- [x] Unit and integration tests cover all ACs.

## 8. Open Questions
- None.
