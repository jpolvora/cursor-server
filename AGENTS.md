# AGENTS.md

Guidance for AI agents working in **cursor-server**.

## Project purpose

**cursor-server** is an HTTP API that executes Cursor agent tasks against **local repository directories** on the host machine. Remote IDE clients delegate work by sending prompts; this server is where those prompts actually run.

Primary use cases (planned / in progress):

1. **Remote task execution** — client sends a prompt + repo identifier; server runs a local Cursor agent in that repo's working tree.
2. **Scheduled automation** — cron jobs for recurring agent work (reviews, triage, repo hygiene).
3. **Continuous review loops** — support deliver / deploy / exec review workflows so remote clients stay in sync with repo changes without running agents locally.

Requirements and endpoint design are not finalized. Prefer small, reviewable increments; avoid speculative features until discussed with the owner.

## Architecture (current)

```text
src/
  index.ts              # Hono app entry, wires routes + scheduler
  config.ts             # Env validation (zod)
  routes/
    health.ts           # GET /health
    tasks.ts            # POST /tasks
  services/
    agent-runner.ts     # @cursor/sdk local Agent.create + send + wait
  jobs/
    scheduler.ts        # node-cron registration (jobs added later)
```

### Runtime choice

Use **local** Cursor SDK runtime for all task execution unless explicitly designing a cloud feature:

```typescript
local: { cwd: repoPath, settingSources: [] }
```

- `settingSources: []` — do not inherit ambient Cursor IDE settings from the server environment unless intentionally changed.
- Always dispose agents (`await using` or `finally` + `[Symbol.asyncDispose]()`).
- Distinguish `CursorAgentError` (startup) from `result.status === "error"` (run failed after start).

### Repository layout on disk

Clients refer to repos by **name**, not absolute path. The server resolves:

```text
{REPOS_ROOT}/{repo}
```

Default `REPOS_ROOT` is `./repos`. Do not hardcode absolute paths in routes.

## Conventions

- **TypeScript**, ESM (`"type": "module"`), Node 20+.
- **Hono** for HTTP; keep handlers thin — business logic in `services/`.
- **Zod** for request and env validation.
- Match existing style: minimal scope, no over-abstraction, no comments unless logic is non-obvious.
- Do not commit secrets (`.env`, API keys).

## SDK patterns to follow

| Pattern | When |
|---------|------|
| `Agent.prompt(...)` | True one-shots with no follow-up |
| `Agent.create()` + `agent.send()` + `run.wait()` | Streaming, multi-turn, or service lifecycle |
| `Agent.resume()` | Cross-process continuation (scheduled jobs, webhooks) |

Log `agentId` and `run.id` after `send()` in production paths.

## Planned areas (not implemented)

Treat these as design placeholders — confirm with the owner before building:

- Authentication / API keys for clients calling this server
- Async job queue (fire-and-forget tasks, status polling, webhooks)
- Run history and persistence
- Repo registration and validation (ensure path exists, is a git repo)
- Streaming task output to clients (SSE / WebSocket)
- Scheduled review jobs (PR diff review, branch sync checks)
- MCP server configuration per task or per repo
- Multi-tenant isolation if multiple clients share one host

## Testing changes

```bash
npm run typecheck
npm run dev
curl http://localhost:3000/health
```

For task endpoints, a real `CURSOR_API_KEY` and a clone under `repos/` are required.

## What not to do

- Do not switch to cloud runtime without an explicit requirement (this server is local-first).
- Do not add large frameworks or ORMs for the initial API surface.
- Do not expand README or this file with speculative feature lists — keep docs aligned with what exists.
