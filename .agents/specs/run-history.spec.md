# Spec: Run History and Persistence (`run-history`)

## Context
Clients and web dashboards require persistence and querying of past and running task executions across server restarts.

## Objectives
1. Persist task records (status, prompt, result, timestamps, agentId, runId) to disk.
2. Provide `GET /tasks` listing endpoint with optional filter parameters (`status`, `repo`, `source`).
3. Retain history across server restarts.

## Acceptance Criteria
- [ ] Task records saved to disk under `REPOS_ROOT/.tasks.json` or equivalent store.
- [ ] `GET /tasks` lists all tasks sorted by `createdAt` descending.
- [ ] Supports filtering via query parameters: `GET /tasks?status=completed&repo=my-repo`.
- [ ] Typecheck, build, and tests pass.
