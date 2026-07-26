---
id: null
slug: 29-fix-task-store-stale-running
title: "Fix stale running/queued tasks after process restart"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix stale running/queued tasks after process restart

## Description

`task-store` persists tasks to `.tasks.json`. After process crash/restart, tasks left in `running` or `queued` stay stuck forever because `loadFromDisk` does not reconcile in-flight rows. Clients polling or streaming those ids never see terminal status.

Parent verify: batch B beyond-AC bug #1. Evidence: `src/services/task-store.ts` `loadFromDisk`.

## Acceptance Criteria

- AC1: On store load (startup), any task with status `running` or `queued` is marked `failed` (or `interrupted`) with a clear `error` explaining process restart / unrecovered worker, and `completedAt` set.
- AC2: Terminal statuses (`completed`, `failed`) are left unchanged.
- AC3: Reconciliation is idempotent across reloads.
- AC4: Unit test with a fixture `.tasks.json` (or in-memory load path) proves stale rows become terminal; `npm run typecheck` / `npm run build` pass.

## Notes

- Optional: emit a one-line console warn listing reconciled task ids.
- Do not auto-resume agents in this spec (that belongs to scheduled review / explicit resume APIs).

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #18 open). Not merged to develop/master yet.
