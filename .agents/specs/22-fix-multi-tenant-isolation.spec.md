---
id: null
slug: 22-fix-multi-tenant-isolation
title: "Fix multi-tenant isolation: limits, env, IDOR, harness ACL"
source: local
specDate: 2026-07-25
complexity: standard
---

# Specification — Fix multi-tenant isolation: limits, env, IDOR, harness ACL

## Description

Spec `17-multi-tenant-isolation` was shipped/merged (PR #9) but verify-plan scored **5/10**. Gaps: no CPU/memory limits; `runTask` never forwards `tenantId` into `runAgentPhase` so `applyTenantEnv` is dead; harness create skips `checkRepoAccess`; get/stream/resume by id ignore tenant ownership (IDOR); list filtering always applies tenant filter (master/admin “see all” missing if promised in plan).

Parent verify: `.agents/plans/17-multi-tenant-isolation/step-05-17-multi-tenant-isolation.plan.report.md`.

## Acceptance Criteria

### AC1: Tenant scope on harness + task by-id APIs

- **Given** a request authenticated as Tenant A,
- **When** creating a harness run for a repo outside Tenant A’s `allowedRepos`,
- **Then** the server returns **403** (same `checkRepoAccess` semantics as `POST /tasks`).
- **Given** Tenant A,
- **When** calling `GET /tasks/:id`, `GET /tasks/:id/stream`, `GET /harness/runs/:runId`, or `POST /harness/runs/:runId/resume` for a resource owned by Tenant B,
- **Then** the server returns **404** (or **403**) and does not leak Tenant B metadata.

### AC2: Tenant env applied on live agent runs

- **Given** `runTask` / `runAgentPhase` invoked with `tenantId`,
- **When** `Agent.create` runs,
- **Then** `CURSOR_TENANT_ID` and `CURSOR_TENANT_REPO_PATH` are set for the duration of the phase and restored afterward (including both phases of `plan+implementer`).

### AC3: Execution resource limits

- **Given** tenant or env-configured CPU/memory limits (document exact env/config keys, e.g. `TENANT_CPU_LIMIT` / `TENANT_MEMORY_LIMIT_MB` or per-tenant map),
- **When** an agent task process/tool sandbox runs for that tenant,
- **Then** limits are applied in a documented, testable way (OS-level when available; otherwise clear “best-effort” policy with tests proving the wiring path). Homelab Node may use `resourceLimits` / cgroup / spawn constraints — pick one approach and document it in README/AGENTS.

### AC4: Tests

- Unit/route tests cover: harness create ACL denial; cross-tenant get-by-id denial; `tenantId` forwarded into `runAgentPhase` (spy/mock env); at least one resource-limit wiring test.
- `npm run typecheck` and `npm run build` pass.

## Notes

- Prefer surgical fixes in `src/routes/harness.ts`, `src/routes/tasks.ts`, `src/services/agent-runner.ts`, `src/services/tenant-context.ts` (+ new limits helper if needed).
- Do not redesign the whole auth model; extend existing `TENANTS` / API-key middleware.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #11 open). Not merged to develop/master yet.
