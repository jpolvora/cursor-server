# Implementation Plan: Multi-Tenant Workspace & Security Isolation

## Goal
Add tenant identity, repo-scoped access control, execution sandboxing, and task/run partitioning to cursor-server.

## Files to touch
1. `src/config.ts` — Add TENANTS env parsing (JSON map of tenantId → apiKey → allowedRepos)
2. `src/middleware/auth.ts` — Rewrite to resolve tenant from API key; declare Hono variable map
3. `src/services/tenant-context.ts` — New: tenant helpers + repo access check
4. `src/services/task-store.ts` — Add `tenantId` field, filter by tenant in listTasks
5. `src/services/stage-store.ts` — Add `tenantId` field, filter by tenant in listRuns
6. `src/services/agent-runner.ts` — Accept tenantId/allowedRepos, set CURSOR_TENANT_* env vars
7. `src/services/task-worker.ts` — Pass tenantId to runTask
8. `src/services/stage-orchestrator.ts` — Accept tenantId in StageRunOptions, pass to createRun
9. `src/routes/tasks.ts` — Read tenant from context, enforce repo access, filter listings
10. `src/routes/events.ts` — Read tenant from context, enforce repo access
11. `src/routes/harness.ts` — Read tenant from context, filter listings

## Acceptance verification
- AC1: auth middleware resolves tenant from X-API-Key/Bearer; repo access enforced in routes
- AC2: CURSOR_TENANT_ID/CURSOR_TENANT_REPO_PATH set in agent env; repoPath used as CWD
- AC3: listTasks/listRuns filter by tenantId when tenant !== master
