---
id: null
slug: 24-fix-task-streaming-progress
title: "Fix task SSE progress output and EventSource auth"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix task SSE progress output and EventSource auth

## Description

`GET /tasks/:id/stream` exists and emits lifecycle status lines, but agent progress / log chunks are not streamed as `output` events during execution (spec `08-task-streaming` AC). Auth is header-only; EventSource clients commonly need `?apiKey=` / `Authorization` query support as stated in the original objectives. AGENTS.md still lists streaming under Planned areas despite shipped probe.

Parent verify: `ms-20260725T230442Z` / `08-task-streaming` score **6/10**. Evidence: `src/services/task-worker.ts`, `src/middleware/auth.ts`, `src/routes/tasks.ts`.

## Acceptance Criteria

- AC1: During async task execution, meaningful progress/log lines (worker lifecycle **and** agent/run output chunks when available from the runner) are appended via `taskStore.emitOutput` and delivered as SSE `output` events to connected stream clients.
- AC2: SSE still emits `status` on connect/change and `done` on terminal states; connection closes cleanly on `completed` | `failed`.
- AC3: When `SERVER_API_KEY` (or tenant keys) require auth, stream endpoint accepts credentials via existing headers **and** query parameters suitable for EventSource (`apiKey` or `access_token` — document the chosen name in README).
- AC4: Unauthorized stream attempts are rejected; cross-tenant stream access follows the same denial policy as `GET /tasks/:id` once tenant fixes land (coordinate with `22-fix-multi-tenant-isolation` if both run).
- AC5: Tests cover at least one `output` event path and query-param auth acceptance; `npm run typecheck` / `npm run build` pass.
- AC6: Remove or update AGENTS.md “Planned: Streaming task output” bullet so it matches shipped+fixed behavior.

## Notes

- If Cursor SDK does not expose fine-grained token streams easily, minimum bar: forward all `emitOutput` lines the worker already can produce, and add hooks where runner stdout is available (OpenCode/Hermes). Document residual limits in Notes of the step-08 result.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #13 open). Not merged to develop/master yet.
