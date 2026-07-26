---
id: null
slug: 23-fix-mcp-merge-wiring
title: "Fix MCP merge-at-task-init and diagnostics"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix MCP merge-at-task-init and diagnostics

## Description

`resolveMcpServers` exists and `GET /repos/:repo/mcp` uses it, but `POST /tasks` only passes body `mcpServers` into `runTask` / `Agent.create`. Spec `18-mcp-config` AC1/AC3 require merge of global + repo + task override at task init. AC4 requires a clear diagnostic when a configured MCP command is invalid/missing; today only JSON load failures warn. Verify also found weak validation (command+url both accepted) and env masking gaps on GET.

Parent verify: `ms-20260725T230442Z` / `18-mcp-config` score **5/10**. Evidence: `src/routes/tasks.ts`, `src/services/mcp-config.ts`, `src/services/agent-runner.ts`.

## Acceptance Criteria

- AC1: On `POST /tasks` (sync and async), before `Agent.create`, resolve MCP servers via `resolveMcpServers(REPOS_ROOT, repo, body.mcpServers)` (or equivalent) so global + repo + override merge is applied.
- AC2: Merged config is what `runTask` / `Agent.create` receive; omitting body `mcpServers` still loads global/repo configs when present.
- AC3: Invalid MCP entries (missing command for stdio servers, contradictory command+url, empty name) are rejected at validation time **or** skipped with a clear warning log that names the server — never crash the host or corrupt task persistence.
- AC4: Before/at agent start, if a stdio MCP `command` is not resolvable on PATH (or absolute path missing), log a clear diagnostic warning (AC4). Task may continue without that server or fail with an explicit MCP error — pick one policy and test it.
- AC5: `GET /repos/:repo/mcp` masks secrets in both `env` and `headers` (if present).
- AC6: Unit tests for merge order and at least one diagnostic path; `npm run typecheck` / `npm run build` pass.

## Notes

- Reuse `src/services/mcp-config.ts`; avoid duplicating merge logic in the route.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #12 open). Not merged to develop/master yet.
