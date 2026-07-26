---
id: null
slug: scheduled-review-jobs
title: "Scheduled Review Jobs (Cron Review Automation & Agent Resume)"
source: local
specDate: 2026-07-25
status: completed
---

# Specification — Scheduled Review Jobs (Cron Review Automation & Agent Resume)

## Description

Add scheduled automated background review jobs using `node-cron` in `src/jobs/scheduler.ts` and runner execution via `src/services/scheduled-review-runner.ts`. Provide sample review jobs for:
1. PR diff review & branch sync check — periodically checks target repos under `REPOS_ROOT` for dirty state / branch divergence or changes and runs an automated agent code review.
2. Triage / repo hygiene review — periodically scans repo hygiene (e.g. state files, uncommitted changes, stale branches) and logs/records findings.
3. Cross-process continuation support — support resuming existing agent runs using `Agent.resume` when specified, enabling multi-step or scheduled resume loops.
4. Configurable job registration — allow jobs to be configured via environment or registered dynamically in `startScheduler(config, defaultJobs)`.

## Acceptance Criteria

- AC1: Provide built-in scheduled review job definitions (`pr-diff-review`, `repo-hygiene-check`) in `src/jobs/review-jobs.ts`.
- AC2: `startScheduler` in `src/jobs/scheduler.ts` loads and registers standard review jobs when enabled in configuration.
- AC3: Implement `ScheduledReviewRunner` or service logic in `src/services/scheduled-review-runner.ts` that executes local agent runs or resumes runs with `Agent.resume`.
- AC4: Expose job execution history / status endpoint or logging for scheduled job runs.
- AC5: All tests and type checks (`npm run typecheck`, `npm run build`) pass cleanly with no lint or build errors.

## Notes

- Uses local Cursor SDK runtime with `cwd` set to target repo under `REPOS_ROOT`.
- Extends the existing `startScheduler(config)` function in `src/jobs/scheduler.ts`.
