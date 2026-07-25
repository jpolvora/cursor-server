---
slug: scheduled-review-jobs
title: "Scheduled Review Jobs (Cron Review Automation & Agent Resume)"
status: "plan to be refined"
---

## 0. Summary & Business Rules
Implement scheduled automated review jobs using `node-cron` and Cursor SDK agent executions. The server will run background jobs (PR diff review, branch sync checks, repo hygiene checks) on a configurable schedule, with support for cross-process continuation using `Agent.resume`.

## 1. Definition of Ready & Scope
- **AC1:** Built-in review job definitions in `src/jobs/review-jobs.ts`.
- **AC2:** `startScheduler` in `src/jobs/scheduler.ts` loads built-in review jobs by default.
- **AC3:** `ScheduledReviewRunner` in `src/services/scheduled-review-runner.ts` executes local Cursor SDK agent runs and supports `Agent.resume`.
- **AC4:** Endpoint `GET /jobs` to inspect registered cron jobs and history.
- **AC5:** Clean build & typecheck without errors.

## 2. Technical Design & Architecture
- **Backend Service:** `src/services/scheduled-review-runner.ts`
  - Encapsulates `Agent.create` and `Agent.resume` execution against `{REPOS_ROOT}/{repo}`.
  - Ensures proper agent disposal via `using` or `try...finally`.
- **Jobs module:** `src/jobs/review-jobs.ts` & `src/jobs/scheduler.ts`
  - Defines `pr-diff-review` and `repo-hygiene-check` handlers.
  - Exposes `createDefaultReviewJobs(config: Config)`.
- **Routes:** `src/routes/jobs.ts`
  - Exposes `GET /jobs` route returning job status and execution history.
- **App Wiring:** `src/index.ts`
  - Wire `/jobs` route and initialize `startScheduler(config)`.

## 3. Step-by-Step Plan
1. **Core Service:** Create `src/services/scheduled-review-runner.ts` with `runReviewTask` supporting new and resumed agent runs.
2. **Review Jobs Definition:** Create `src/jobs/review-jobs.ts` defining standard review jobs and `createDefaultReviewJobs`.
3. **Scheduler Integration:** Update `src/jobs/scheduler.ts` to register default review jobs and store execution metrics/history.
4. **HTTP Routes:** Create `src/routes/jobs.ts` for `GET /jobs` endpoint.
5. **Server Wiring:** Update `src/index.ts` to mount `/jobs` routes with authentication.

## 4. Permissions, Tenancy & i18n
- `/jobs` protected by `authMiddleware(config)` when `SERVER_API_KEY` is configured.
- Repo resolution remains strictly bounded to `{REPOS_ROOT}/{repo}`.

## 5. Test Coverage
- AC1 & AC2: Unit test `startScheduler` with review jobs in `src/jobs/scheduler.test.ts`.
- AC3: Unit test `scheduled-review-runner` verifying local runtime settings and disposal.
- AC4: Route test for `GET /jobs`.
- AC5: Run `npm run typecheck` and `npm run build`.

## 6. Invariants (Do Not Violate)
- Always use local SDK runtime (`local: { cwd: repoPath, settingSources: [] }`).
- Always dispose agents.
- Thin routes, business logic in services.
- Repos resolved relative to `REPOS_ROOT`.

## 7. Pre-PR Checklist
- [x] Layer boundaries respected.
- [x] Invariants verified.
- [x] ACs mapped to test strategy.

## 8. Open Questions
None (standard implementation).
