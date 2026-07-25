# Implementation Plan — Streaming Task Output to Clients (`task-streaming`)

## Goal
Implement real-time Server-Sent Events (SSE) streaming for agent task execution (`GET /tasks/:id/stream`) so clients can observe live status transitions and output logs.

## Proposed Changes

### `src/services/task-store.ts`
- Add an `EventEmitter` to `TaskStore` to broadcast task state changes (`task:status`) and task output events (`task:output`).
- Add method `emitOutput(id: string, chunk: string)` to broadcast live execution logs.
- Trigger `task:status` events inside `createTask()` and `updateTask()`.

### `src/services/task-worker.ts`
- Update `processTaskInBackground()` to emit `task:output` events as logs are generated during execution.

### `src/middleware/auth.ts`
- Support `api_key` or `token` query parameters for SSE streaming endpoints where browser `EventSource` cannot customize headers.

### `src/routes/tasks.ts`
- Add `GET /tasks/:id/stream` using Hono's `streamSSE` utility.
- Send initial task state event on connection.
- Subscribe to `taskStore` event emitter for matching `taskId`.
- Send `status` and `output` events.
- On `completed` or `failed` status, emit `done` event and close stream.
- Handle connection abort and unsubscribe event listeners safely.

## Verification Plan

### Automated Verification
- Run `npm run typecheck` (`tsc --noEmit`).
- Run `npm run build` (`tsc`).

### Manual Verification
- Test SSE streaming endpoint via `curl -N http://localhost:3000/tasks/<id>/stream`.
