---
id: null
slug: task-streaming
title: "Streaming Task Output to Clients (task-streaming)"
source: local
specDate: 2026-07-25
status: completed
---

# Specification — Streaming Task Output to Clients (`task-streaming`)

## Context
Clients (IDE extensions, dashboards, Hermes Agent) running long agent tasks against `cursor-server` currently poll `GET /tasks/:id` for completion. Callers need real-time streaming updates (`GET /tasks/:id/stream`) via Server-Sent Events (SSE) to observe agent output line-by-line as it executes.

## Objectives
1. Expose `GET /tasks/:id/stream` endpoint for SSE streaming.
2. Broadcast real-time status changes and output log chunks generated during task execution in `task-worker.ts`.
3. Support authentication via `SERVER_API_KEY` (using `X-API-Key` or `Authorization` query/header parameters).
4. Gracefully close the stream when task status reaches `completed` or `failed`.

## Acceptance Criteria
- [x] `GET /tasks/:id/stream` returns HTTP `200` with header `Content-Type: text/event-stream`.
- [x] Streams `status` event on connection and when task status changes (`queued` -> `running` -> `completed` | `failed`).
- [x] Streams `output` event chunks as logs/agent progress lines arrive.
- [x] Emits `done` event and closes connection when task finishes execution.
- [x] Rejects unauthorized connection attempts when `SERVER_API_KEY` is set.
- [x] Typecheck (`npm run typecheck`) and build (`npm run build`) pass.
