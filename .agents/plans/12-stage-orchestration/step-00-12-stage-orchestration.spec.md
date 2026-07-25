---
id: 12-stage-orchestration
title: "Stage Pipeline Orchestration & Observability Service"
slug: 12-stage-orchestration
source: local
specDate: 2026-07-25
status: draft
version: 0.1.0
---

# Stage Pipeline Orchestration & Observability Service

## Description
Implement the core Stage Orchestration engine for `cursor-server`. The orchestrator executes machine-actionable qualified specifications (loaded via `spec-schema.ts`) sequentially across defined pipeline stages (`spec` → `implement` → `build` → `test` → `deploy` → `review`). It coordinates stage execution using registered `HarnessRunner` implementations, captures granular per-stage execution logs and generated artifacts, maintains run state persistence, and provides resumability for failed pipeline runs.

---

## Acceptance Criteria

### AC1: Sequential Stage Pipeline Execution
- **Given** a validated `QualifiedSpec` document,
- **When** `StageOrchestrator.run(spec, repoPath, options)` is invoked,
- **Then** it executes each stage in sequential order (`spec` → `implement` → `build` → `test` → `deploy` → `review`) using the configured `HarnessRunner`.

### AC2: Per-Stage Observability & Artifact Tracking
- **Given** a stage is executing within the pipeline,
- **When** the stage completes (or fails),
- **Then** the orchestrator records execution metadata including `stage`, `status` (`success` | `failed` | `error`), `durationMs`, stdout/stderr logs, output artifacts, and step errors into the pipeline run state.

### AC3: Resumability & Checkpointing
- **Given** a pipeline execution fails at a specific stage (e.g. `test`),
- **When** `StageOrchestrator.resume(runId)` is called,
- **Then** execution resumes from the failed stage without re-running earlier successful stages (`spec`, `implement`, `build`).

### AC4: Stage Orchestration API Endpoints
- **Given** client API endpoints `POST /harness/runs` and `POST /harness/runs/:runId/resume`,
- **When** called with valid payloads and authentication,
- **Then** the server dispatches stage pipeline runs asynchronously, returning `202 Accepted` with a unique `runId` and full status querying at `GET /harness/runs/:runId`.

---

## Technical Guidance & Architecture
- Use `HarnessRunner` interface and `runnerRegistry` from `src/services/harness-runner.ts`.
- Use `parseSpecMarkdown` / `QualifiedSpec` from `src/services/spec-schema.ts`.
- Persist pipeline run state to JSON/SQLite storage, extending `src/services/task-store.ts`.
