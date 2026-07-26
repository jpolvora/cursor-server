# Plan — 37-websocket-streaming

## Approach

1. Upgrade `@hono/node-server` v2 for built-in `upgradeWebSocket`; add `ws` dependency.
2. Extract `attachTaskStream` helper (`src/services/task-stream.ts`) for shared event semantics.
3. Add `GET /tasks/:id/ws` route with same auth/tenant checks as SSE.
4. Wire `WebSocketServer` in `src/index.ts`.
5. Add focused WebSocket auth/stream tests; document protocol in README.

## Verification

- `npm run typecheck`
- `npm run build`
- `node --test dist/routes/tasks-ws.test.js dist/routes/tasks.test.js`
