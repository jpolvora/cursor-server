# Fix PR #9 Code Review Threads

Resolve 6 open threads from the agentic code review pipeline on PR #9.

## Issues

### AC1: agent-runner.ts — applyTenantEnv process.env cleanup
`applyTenantEnv` mutates global `process.env` without restoring previous values. In concurrent requests, tenant identity leaks between runs. Fix: save-and-restore pattern with a cleanup function called in `finally`.

### AC2: config.ts — parseTenants silent failures
`parseTenants` returns `[]` silently for any parse failure (malformed JSON, wrong type). The operator gets no warning. Fix: add `console.warn`/`console.error` logging in error paths, log parsed tenant count.

### AC3: tenant-context.ts — dead exports + wire checkRepoAccess
5 unused exports (`enforceRepoSafety`, `checkRepoAccess`, `configFromEnv`, `parseResourceLimits`, `TENANT_HEADER`, `tenantMiddleware`). Wire `checkRepoAccess` into `tasks.ts` and `events.ts` replacing inline checks. Remove dead exports.

### AC4: auth.ts — backward compat for open-access deployments
Auth middleware always requires credentials, breaking deployments without `SERVER_API_KEY`. The startup warning says auth is disabled but runtime enforces it. Fix: skip auth when `!config.SERVER_API_KEY && config.TENANTS.length === 0`, set tenant to `"anonymous"`. Update the warning message.

### AC5: specs.ts — MCP endpoints missing allowedRepos check
GET and POST `/:repo/mcp` endpoints don't enforce tenant repo access. Fix: add `allowedRepos` gate matching the pattern in `tasks.ts`/`events.ts`.

## Acceptance

- [ ] AC1: process.env restored after agent execution
- [ ] AC2: parse failures emit console.error; parsed count logged
- [ ] AC3: tasks.ts and events.ts use `checkRepoAccess`; dead exports removed
- [ ] AC4: no-SERVER_API_KEY deployments work; warning message accurate
- [ ] AC5: MCP endpoints reject repos not in allowedRepos
- [ ] All 6 threads on PR #9 resolvable
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
