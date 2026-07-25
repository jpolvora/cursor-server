# Execution Plan & DAG — `task-streaming`

## Execution Mode
`execMode: sequential`

## Execution Steps

1. **Step T1**: Update `src/middleware/auth.ts` to accept `api_key` / `token` query parameters for SSE stream authentication.
2. **Step T2**: Enhance `src/services/task-store.ts` with `EventEmitter` for `task:status` and `task:output`.
3. **Step T3**: Update `src/services/task-worker.ts` to emit logs via `taskStore.emitOutput()`.
4. **Step T4**: Add `GET /tasks/:id/stream` route using `streamSSE` in `src/routes/tasks.ts`.
5. **Step T5**: Verify build and typecheck.
