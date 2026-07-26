---
id: null
slug: 37-websocket-streaming
title: "WebSocket task streaming (alongside SSE)"
source: local
specDate: 2026-07-26
status: completed
version: 0.1.0
---

# Specification — WebSocket task streaming

## Description

Add a WebSocket transport for task progress/output as an alternative to existing SSE (`GET /tasks/:id/stream`, fix `24`). Clients that prefer bidirectional sockets (or environments where EventSource is awkward) can subscribe to the same status/output/done events. SSE remains supported; WebSocket must not replace or break it.

Depends on: task store + worker event emitters (`06`/`08`/`24`), auth patterns (`X-API-Key` / Bearer / query token for upgrade).

## Acceptance Criteria

- AC1: Authenticated clients can open a WebSocket for a task id and receive `status`, `output`, and `done` events equivalent to SSE semantics.
- AC2: Auth accepts the same credentials as SSE (header and/or query token suitable for browser WebSocket).
- AC3: Existing `GET /tasks/:id/stream` SSE behavior is unchanged (regression-safe).
- AC4: Documented client URL/protocol (path, message shape) in README or docs.
- AC5: Typecheck, build, and a focused stream/auth test for the WebSocket path pass.
- AC6: Non-goals for v1: replacing SSE, multiplexing unrelated channels, public internet exposure assumptions.

## Notes

- Keep event payload shape aligned with SSE so UI clients can share parsers where possible.
