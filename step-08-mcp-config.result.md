# MCP Server Configuration — Delivery Result

## Summary
Implemented MCP server configuration management for `cursor-server`. Supports global (`MCP_CONFIG_PATH` or `config/mcp.json`), repo-level (`.cursor/mcp.json` or `.mcp.json`), and per-task override in `POST /tasks`. Resolved config is injected into the Cursor SDK `Agent.create` runtime.

## Verification
- `npm run typecheck` — PASS
- `npm run build` — PASS
- `npm run scan-secrets` — PASS

## Files (7)
| File | Status |
|------|--------|
| `src/config.ts` | Modified |
| `src/services/mcp-config.ts` | Created |
| `src/routes/tasks.ts` | Modified |
| `src/services/agent-runner.ts` | Modified |
| `src/services/task-store.ts` | Modified |
| `src/services/task-worker.ts` | Modified |
| `src/routes/specs.ts` | Modified |
