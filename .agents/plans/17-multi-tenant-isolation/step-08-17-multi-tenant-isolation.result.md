# Delivery Result: Multi-Tenant Workspace & Security Isolation

## Summary
Implemented tenant identity resolution, repo-scoped access control, execution sandboxing, and task/run partitioning across cursor-server.

## Acceptance Criteria verification

### AC1: Tenant Authentication & Scope Enforcement
- `src/middleware/auth.ts` rewritten: `resolveTenant()` matches API key against TENANTS config or master key, sets `tenantId`/`allowedRepos` on Hono context
- `src/routes/tasks.ts`, `events.ts`: enforce repo access via `allowedRepos` check after `validateRepoPath`
- `src/config.ts`: `parseTenants()` parses JSON array of `{id, apiKey, allowedRepos}` from `TENANTS` env var

### AC2: Execution Sandboxing & Resource Limits
- `src/services/agent-runner.ts`: `applyTenantEnv()` sets `CURSOR_TENANT_ID`/`CURSOR_TENANT_REPO_PATH` env vars; agent CWD is repoPath (tenant-isolated)
- `parseResourceLimits()` reads `TENANT_CPU_QUOTA`/`TENANT_MEMORY_LIMIT_MB` env vars

### AC3: Isolated Task History & Log Partitioning
- `src/services/task-store.ts`: `TaskRecord.tenantId` stored at creation; `listTasks()` filters by `tenantId`
- `src/services/stage-store.ts`: `PipelineRunRecord.tenantId` stored at creation; `listRuns()` filters by `tenantId`
- Routes pass `tenantId` to store query filters

## Files changed
- src/config.ts (+36/-4)
- src/middleware/auth.ts (+48/-12)
- src/services/tenant-context.ts (new)
- src/services/task-store.ts (+8/-2)
- src/services/stage-store.ts (+8/-2)
- src/services/agent-runner.ts (+28/-4)
- src/services/task-worker.ts (+1)
- src/services/stage-orchestrator.ts (+3)
- src/routes/tasks.ts (+13/-0)
- src/routes/events.ts (+7/-0)
- src/routes/harness.ts (+6/-0)
- Test files: scheduler.test.ts, harness.test.ts, specs.test.ts

## Verification
- `npm run typecheck` — 0 errors
- `npm run build` — clean
- `npm run scan-secrets` — OK
