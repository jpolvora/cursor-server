---
id: null
slug: 25-fix-scheduled-review-jobs
title: "Fix scheduled review jobs: hygiene, enable gate, Agent.resume"
source: local
specDate: 2026-07-25
complexity: standard
---

# Specification — Fix scheduled review jobs: hygiene, enable gate, Agent.resume

## Description

Spec `09-scheduled-review-jobs` was probed as already-implemented but verify-plan scored **5/10**. `repo-hygiene-check` always records a placeholder skip; jobs register unconditionally (no enable-in-config gate per AC2); scheduled paths do not use `Agent.resume` for cross-process continuation; always-on cron can burn agent quota.

Parent verify: `.agents/plans/scheduled-review-jobs/step-05-scheduled-review-jobs.plan.report.md`. Evidence: `src/jobs/review-jobs.ts`, `src/jobs/scheduler.ts`, `src/index.ts`.

## Acceptance Criteria

- AC1: Implement real `repo-hygiene-check` behavior: for each (or configured) repo under `REPOS_ROOT`, detect uncommitted changes / dirty worktree and/or stale branch signals; record findings via existing job execution history (not a permanent placeholder skip). Empty `REPOS_ROOT` may still skip with a clear reason.
- AC2: Review jobs register only when enabled in configuration (env and/or config flag, e.g. `SCHEDULED_REVIEW_JOBS=true` or per-job toggles). Default **off** in production-safe setups unless explicitly enabled; document the flag in README / `.env.example`.
- AC3: Provide a documented path to resume an existing Cursor agent run via `Agent.resume` when a job payload supplies `agentId` (or equivalent). Unit-test the branch with a mocked SDK; live resume optional.
- AC4: `pr-diff-review` remains functional when jobs are enabled; job history/status logging (AC4 of original) still works.
- AC5: Tests cover hygiene findings recording, enable-gate (jobs absent when disabled), and resume branch; `npm run typecheck` / `npm run build` pass.
- AC6: Update AGENTS.md Planned areas so scheduled review is no longer listed as unimplemented once this lands.

## Notes

- Keep local Cursor SDK runtime (`cwd` under `REPOS_ROOT`).
- Avoid running agents in unit tests; mock `Agent.create` / `Agent.resume`.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #14 open). Not merged to develop/master yet.
