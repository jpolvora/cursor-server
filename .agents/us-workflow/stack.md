# Stack Definition — US Workflow (cursor-server)

Stack-specific commands, paths, and rules for **cursor-server**. The workflow orchestrator and subagents consult this file for builds, tests, diff scope, and canonical doc links.

## Project Stack Overview

- **Runtime:** Node.js 20+, **TypeScript** (ESM, `"type": "module"`).
- **HTTP:** [Hono](https://hono.dev) — thin route handlers in `src/routes/`.
- **Validation:** [Zod](https://zod.dev) — env (`src/config.ts`) and request bodies.
- **Agent execution:** [@cursor/sdk](https://cursor.com/docs/api/sdk/typescript) — local runtime only (`cwd: repoPath`, `settingSources: []`).
- **Scheduling:** `node-cron` — job registration in `src/jobs/scheduler.ts`.
- **Layout:** repo clones under `{REPOS_ROOT}/{repo}` (default `./repos/`); server code under `src/`.
- **Source control:** GitHub via `gh` CLI; base branch **`main`** (fallback `master`). PR review via [`code-review`](../skills/code-review/SKILL.md) / [`solve-pr`](../skills/solve-pr/SKILL.md).

## Code Paths (mutating steps)

| Layer | Glob / path | Notes |
|-------|-------------|-------|
| **Entry** | `src/index.ts` | Hono app, route wiring, scheduler start |
| **Config** | `src/config.ts` | Zod env schema; no secrets in code |
| **Routes** | `src/routes/` | HTTP handlers only — delegate to services |
| **Services** | `src/services/` | Business logic, SDK integration |
| **Jobs** | `src/jobs/` | Cron registration and job handlers |
| **Types** | colocated or `src/types/` | Shared types when needed |

**Dry-run / isolation:** Steps 5, 10, 11 mutate `src/` only when implementing code.

## Validation & Quality Commands

| Layer | Type | Command | Notes |
|-------|------|---------|-------|
| **TypeScript** | Typecheck | `npm run typecheck` | Required before PR |
| **TypeScript** | Build | `npm run build` | Emits `dist/` |
| **Runtime** | Dev server | `npm run dev` | `tsx watch src/index.ts` |
| **Runtime** | Health | `curl http://localhost:3000/health` | After server start |
| **Tasks API** | Smoke | `curl -X POST http://localhost:3000/tasks -H 'Content-Type: application/json' -d '{"prompt":"...","repo":"my-app"}'` | Needs `CURSOR_API_KEY` + clone under `repos/` |

**When `skipTests: true`:** skip optional integration smoke; **typecheck** and **build** still run.

> **Port conflicts:** default `PORT=3000`. If bind fails, ask the user before stopping their process.

## Stack Rules & Skills

| Area | Canonical source |
|------|------------------|
| **Harness routing** | [`AGENTS.md`](../../AGENTS.md) |
| **Engineering guardrails** | [`.agents/skills/senior-developer/SKILL.md`](../skills/senior-developer/SKILL.md) + [`TESTING.md`](../skills/senior-developer/TESTING.md) |
| **SDK patterns** | [`AGENTS.md`](../../AGENTS.md) § SDK patterns; [`README.md`](../../README.md) |
| **Security review** | [`.agents/skills/security-review/SKILL.md`](../skills/security-review/SKILL.md) |
| **Shared repo memory** | [`MEMORY.md`](../../MEMORY.md) (repo root, when present) |

Delegated workflow skills (Steps 1–11) live under `.agents/skills/` — see [`us-workflow.md`](us-workflow.md) § Allowed dependencies.

## Code Review Diff Scope (Step 9)

Scoped diff vs base branch:

```bash
git diff {base_branch}...HEAD -- \
  'src/**' 'package.json' 'tsconfig.json' \
  ':!dist/**' \
  ':!node_modules/**'
```

Replace `{base_branch}` with the value from **Dynamic Environment Detection** below.

## cursor-server Invariants (workflow-critical)

| Never | Always |
|-------|--------|
| Cloud SDK runtime without explicit requirement | Local runtime: `local: { cwd, settingSources: [] }` |
| Leak `CURSOR_API_KEY` in logs or responses | Secrets from env only |
| Business logic in route handlers | Thin routes → services |
| Skip agent disposal | `await using` or `finally` + `[Symbol.asyncDispose]()` |
| Hardcode absolute repo paths | Resolve via `{REPOS_ROOT}/{repo}` |
| Implement roadmap items without owner go-ahead | Small increments; confirm major features |

## Dynamic Environment Detection

| Setting | Detection |
|---------|-----------|
| **Base branch** | `git rev-parse --verify main >/dev/null 2>&1 && echo main \|\| echo master` |
| **Git remote** | `origin` — use `git push origin ...` / `gh` for PR ops |
| **API running** | Port from `PORT` env (default `3000`) — ask user before stopping |
| **Task smoke** | Requires clone under `repos/<name>` and valid `CURSOR_API_KEY` |
