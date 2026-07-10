# AGENTS.md

Guidance for AI agents working in **cursor-server**.

## Project purpose

**cursor-server** is an HTTP API that executes agent tasks against **local repository directories** on a home-lab host. Remote IDE clients (home or company laptops on Tailscale) delegate work by sending prompts or specs; this server is where that work actually runs.

Primary use cases (planned / in progress):

1. **Remote task execution** — client sends a prompt + repo identifier; server runs an agent in that repo's working tree.
2. **Scheduled automation** — cron jobs for recurring agent work (reviews, triage, repo hygiene).
3. **Continuous review loops** — deliver / deploy / exec review workflows so remote clients stay in sync with repo changes.
4. **Spec-driven pipeline** — hosted spec editor/environment; fully qualified, detailed specs drive implement → build → test → deploy → review through a specialized harness.
5. **Pluggable harnesses** — same spec pipeline runnable by Cursor SDK agents, [Hermes Agent](https://github.com/NousResearch/hermes-agent), OpenCode, or future runners.

Requirements and endpoint design are not finalized. Prefer small, reviewable increments; confirm major features with the owner before building.

## Deployment context

- **Host**: home lab server (Umbrel, Docker Compose stack, or bare Node).
- **Access**: Tailscale tailnet — clients on home/company laptops reach the API over VPN; avoid assuming public-internet exposure.
- **Data**: repo clones live under `REPOS_ROOT` (volume-mounted in container deployments).
- **Packaging**: Docker Compose is the intended production path; manifest not yet in repo.

When adding deployment artifacts, favor Compose over bespoke scripts; keep Umbrel compatibility (standard Compose, clear env vars, persistent volumes).

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

## Roadmap (design intent)

Documented here so agents understand direction without treating it as shipped code.

### Hermes integration

Plan to integrate [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) as an orchestration layer alongside Cursor SDK runs. Hermes brings scheduled automations, subagent delegation, persistent memory/skills, and bundled skills for coding agents (including OpenCode). It may coordinate multi-step workflows or hand off stage-specific work. Exact boundary (Hermes vs Cursor SDK per pipeline stage) TBD.

### Spec editor & qualified-spec harness

Flagship feature: a **served spec editor/environment** where authors produce **fully qualified, complete specifications** (not vague prompts). A harness executes each spec through fixed stages:

```text
spec (qualified) → implement → build → test → deploy → review
```

Each stage should be observable (logs, artifacts, pass/fail), resumable, and tied back to spec sections. The spec format and UI are not defined yet — design for machine-actionable structure (IDs, acceptance criteria, dependencies between items).

### Pluggable harness abstraction

Do not hard-couple pipeline logic to `@cursor/sdk`. Introduce a runner interface when implementing the harness so executors can include:

| Runner | Role (planned) |
|--------|----------------|
| **Cursor SDK** | Local agent runs against repo `cwd` (current default) |
| **Hermes Agent** | Orchestration, scheduling, memory/skills, delegation to coding agents |
| **OpenCode** | Autonomous coding agent CLI (Hermes can orchestrate via bundled skill) |

New runners plug in behind the same spec → stage → outcome contract.

## Planned areas (not implemented)

Treat these as design placeholders — confirm with the owner before building:

- Docker Compose stack + Umbrel-friendly packaging
- Tailscale-oriented bind/config defaults and docs
- Authentication / API keys for clients calling this server
- Async job queue (fire-and-forget tasks, status polling, webhooks)
- Run history and persistence
- Repo registration and validation (ensure path exists, is a git repo)
- Streaming task output to clients (SSE / WebSocket)
- Scheduled review jobs (PR diff review, branch sync checks)
- MCP server configuration per task or per repo
- Spec schema, editor UI, and stage orchestration service
- Hermes and OpenCode harness adapters
- Multi-tenant isolation if multiple clients share one host

## Testing changes

```bash
npm run typecheck
npm run dev
curl http://localhost:3000/health
```

For task endpoints, a real `CURSOR_API_KEY` and a clone under `repos/` are required.

## What not to do

- Do not switch to cloud runtime without an explicit requirement (this server is local-first / homelab-first).
- Do not add large frameworks or ORMs for the initial API surface.
- Do not implement roadmap items (Docker, spec editor, Hermes) without explicit owner go-ahead — but **do** keep README/AGENTS roadmap sections updated when vision changes.
