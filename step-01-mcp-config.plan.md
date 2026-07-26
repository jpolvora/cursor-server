# MCP Server Configuration per Repo and Task — Plan

## Goal
Enable MCP server configuration at global, repo, and task levels, with resolution merging and runtime injection into the Cursor SDK agent.

## Files to change
| File | Action |
|------|--------|
| `src/config.ts` | Add `MCP_CONFIG_PATH` env var |
| `src/services/mcp-config.ts` | **New** — MCP config load, merge, mask, validate |
| `src/routes/tasks.ts` | Add `mcpServers` to Zod schema, pass through to runner |
| `src/services/agent-runner.ts` | Accept `mcpServers`, inject into `Agent.create` |
| `src/services/task-store.ts` | Store `mcpServers` in task record |
| `src/services/task-worker.ts` | Pass `mcpServers` to `runTask` |
| `src/routes/specs.ts` | Add `GET /:repo/mcp`, `POST /:repo/mcp/validate` |

## AC Checklist
- [x] AC1: Global + repo + task-level merge resolution
- [x] AC2: Zod-validated `mcpServers` in POST /tasks
- [x] AC3: Injected into Cursor SDK `Agent.create` via `mcpServers` option
- [x] AC4: Diagnostic warnings on bad config (logged, non-fatal)
- [x] AC5: `GET /repos/:repo/mcp` with secrets masked
