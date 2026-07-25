# Spec: Async Task Queue (`async-task-queue`)

## Context
Running Cursor SDK agents synchronously over HTTP can lead to long request timeouts. Callers (IDE extensions, Hermes Agent, webhooks) require non-blocking task submission with immediate response and background execution.

## Objectives
1. Allow `POST /tasks` to accept `async: true` (or process asynchronously).
2. Return HTTP `202 Accepted` immediately with `taskId` and task metadata.
3. Queue and execute tasks asynchronously in a background worker queue.
4. Support task status polling via `GET /tasks/:id`.

## Acceptance Criteria
- [ ] `POST /tasks` with `{ async: true, ... }` returns HTTP `202 Accepted` with `{ taskId, status: "queued", repo, agent }`.
- [ ] Task state transitions: `queued` ➔ `running` ➔ `completed` or `failed`.
- [ ] `GET /tasks/:id` returns full task status, duration, error or result summary once finished.
- [ ] Non-blocking execution prevents client timeouts.
- [ ] Typecheck, build, and tests pass.
