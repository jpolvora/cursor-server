# AGENTS.md

Guidance for AI agents working in **cursor-server**.

## Project purpose

**cursor-server** is an HTTP API that executes agent tasks against **local repository directories** on a home-lab host. Remote IDE clients (home or company laptops on Tailscale) delegate work by sending prompts or specs; this server is where that work actually runs.

Primary use cases (shipped; see caveats below for rough edges):

1. **Remote task execution** — `POST /tasks` runs local Cursor SDK agents in a named repo (`async` default; sync via `async: false`).
2. **Scheduled automation** — `node-cron` registers review jobs (`pr-diff-review`, `branch-sync-check`) at startup; inspect via `GET /jobs`.
3. **Continuous review loops** — scheduled review runner + `POST /events` gateway for Hermes/Umbrel/IDE triggers.
4. **Spec-driven pipeline** — `GET /ui/spec-editor`, qualified spec schema, stage orchestration, and `POST /harness/runs`.
5. **Pluggable harnesses** — runner registry with Cursor SDK (`cursor-local`, `cursor-sdk`), [Hermes Agent](https://github.com/NousResearch/hermes-agent) (`hermes`), and OpenCode (`opencode`).

Prefer small, reviewable increments; confirm major new roadmap items with the owner before building.

## Deployment context

- **Host**: home lab server (Umbrel, Docker Compose stack, or bare Node).
- **Access**: Tailscale tailnet — clients on home/company laptops reach the API over VPN; avoid assuming public-internet exposure. Client URL: `http://<host-tailscale-ip-or-MagicDNS>:<PORT>` (see [docs/docker.md](./docs/docker.md#network--tailscale)).
- **Bind**: recommended `HOST=0.0.0.0` (app default and Compose) so Tailscale/LAN clients can reach the published port; `127.0.0.1` is localhost-only.
- **Data**: repo clones live under `REPOS_ROOT` (volume-mounted in container deployments).
- **Packaging**: Docker Compose is the production path (`Dockerfile`, `docker-compose.yml`, [docs/docker.md](./docs/docker.md)). Tailscale bind/client-access docs landed with packaging (docs-first; no Serve/Funnel required).

When adding deployment artifacts, favor Compose over bespoke scripts; keep Umbrel compatibility (standard Compose, clear env vars, persistent volumes).

## Architecture (current)

```text
src/
  index.ts              # Hono app entry, routes + scheduler; GET /agents
  config.ts             # Env validation (zod); TENANTS parse
  agents.ts             # Task agent allowlist + resolveAgent (fallback → default)
  middleware/auth.ts    # SERVER_API_KEY / TENANTS / X-API-Key gate
  routes/
    health.ts           # GET /health
    tasks.ts            # POST/GET /tasks; GET /tasks/:id/stream (SSE)
    events.ts           # POST /events — event gateway
    jobs.ts             # GET /jobs — scheduler + review job history
    ui.ts               # GET /ui/spec-editor (public HTML editor)
    specs.ts            # POST /specs/validate; GET/PUT /repos/:repo/specs[/:file]
    harness.ts          # POST /harness/runs — stage pipeline runs
  services/
    agent-runner.ts     # @cursor/sdk local Agent.create + send + wait (role prompts)
    task-store.ts       # Async task persistence + SSE event emitters
    task-worker.ts      # Background task execution
    repo-validator.ts   # Exist + git-repo checks before agent start
    spec-schema.ts      # QualifiedSpec parse/validate + safe .agents/specs IO
    harness-runner.ts   # RunnerRegistry + Cursor SDK adapters
    hermes-runner.ts    # Hermes CLI harness adapter (id: hermes)
    opencode-runner.ts  # OpenCode CLI harness adapter (id: opencode)
    stage-orchestrator.ts / stage-store.ts
    mcp-config.ts       # Global/repo/task MCP merge resolver
    tenant-context.ts   # Per-tenant repo allowlist checks
    scheduled-review-runner.ts
  jobs/
    scheduler.ts        # node-cron registration
    review-jobs.ts      # Default pr-diff-review + branch-sync-check jobs
```

### Task agent roles

`POST /tasks` accepts optional `agent`. Allowlist in `src/agents.ts`; unknown / missing → `default` (alias `generic`).

| Role | Behavior |
|------|----------|
| `default` | Single run; prompt as-is |
| `planner` | Plan-only prompt (no implement) |
| `implementer` | Implement-focused single run |
| `plan+implementer` | Plan phase, then implement with that plan |

List via `GET /agents`. Future workflow-skills exclusive agents (`spec-to-pr*`) are a separate Phase 2 roadmap item — do not conflate with these roles.

`GET /tasks/:id/stream` emits SSE `status`, `output`, and `done` events for async tasks. Auth accepts `X-API-Key`, `Authorization: Bearer`, or query `apiKey` / `access_token` (for `EventSource`).

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

Documented here so agents understand direction. **Shipped** items are summarized above; this section covers remaining gaps and aspirational work.

### Hermes integration (landed with caveats)

`HermesRunner` (`id: hermes`) is registered in `RunnerRegistry` and selectable via `runnerId` on harness runs. Hermes CLI invocation uses `HERMES_BIN` (default `hermes`). Scheduled review jobs and `POST /events` accept `source: hermes`.

**Caveats:** CLI must be installed and on PATH; health-check and CLI edge cases are tracked in fix specs (e.g. `20-fix-hermes-cli-and-health`). Hermes orchestration boundaries vs Cursor SDK per stage are still evolving.

### Spec editor & qualified-spec harness (MVP landed)

A **served spec editor/environment** where authors produce **fully qualified, complete specifications**. A harness executes each spec through stages:

```text
spec (qualified) → implement → build → test → review
```

(`deploy` is optional per spec frontmatter; default stage list omits it.)

**Landed:** `GET /ui/spec-editor`, QualifiedSpec parse/validate, stage orchestration, resumable runs (`POST /harness/runs`, stage store), and pluggable runners. Each stage is observable (logs, artifacts, pass/fail).

**Still open:** Aspirational UI (AC builder, dependency graph, stage designer) beyond MVP Markdown editor.

### Pluggable harness abstraction (landed)

Pipeline logic is behind `HarnessRunner` + `RunnerRegistry`; do not hard-couple new stages to `@cursor/sdk` directly.

| Runner | `id` | Status |
|--------|------|--------|
| **Cursor SDK** | `cursor-local`, `cursor-sdk` | Default; local `cwd` runs |
| **Hermes Agent** | `hermes` | CLI adapter registered; see caveats above |
| **OpenCode** | `opencode` | CLI adapter registered; requires `opencode` on PATH / `OPENCODE_BIN` |

New runners plug in via `runnerRegistry.register()` behind the same spec → stage → outcome contract.

## Planned areas (remaining gaps)

Treat these as design placeholders or partial implementations — confirm with the owner before expanding scope:

- **WebSocket streaming** — task output streams via SSE (`GET /tasks/:id/stream`); WebSocket not implemented
- **MCP wiring polish** — `mcp-config.ts` merges global/repo/task overrides; end-to-end merge into agent runs may have gaps (see `23-fix-mcp-merge-wiring`)
- **Multi-tenant hardening** — `TENANTS` JSON + per-tenant `allowedRepos` scoping exists; stronger isolation if multiple clients share one host is partial (see `22-fix-multi-tenant-isolation`)
- **Scheduled review robustness** — default cron jobs register at startup; operational edge cases tracked in `25-fix-scheduled-review-jobs`
- **Task streaming progress** — SSE status/output events exist; richer progress semantics tracked in `24-fix-task-streaming-progress`
- **Spec editor aspirational UI** — AC builder, dependency graph, stage designer beyond MVP Markdown editor
- **Umbrel App Store manifest** — Compose path documented; store listing not built
- **workflow-skills `spec-to-pr*` exclusive agents** — installed skills present; dedicated server agent profile for driving orchestrators end-to-end is a separate Phase 2 item

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
- Do not expand remaining roadmap gaps (Umbrel App Store manifest, aspirational spec-editor UI, WebSocket streaming, workflow-skills exclusive agents) without explicit owner go-ahead — but **do** keep README/AGENTS roadmap sections updated when shipped code or vision changes.

---

## Skills / agent hub ([workflow-skills](https://github.com/jpolvora/workflow-skills))

This repo consumes the **full** package. Skills live under `.agents/skills/`. Do **not** add parallel local copies of packaged skills, and do **not** treat in-place edits under those folders as permanent (`update` overwrites them). Lasting skill fixes go upstream via PR to [workflow-skills](https://github.com/jpolvora/workflow-skills), then `update` here.

| Doc | Role |
|-----|------|
| [`.agents/skills/shared/AGENTS.md`](.agents/skills/shared/AGENTS.md) | **Agent hub** — skill loading, task router, gates, external deps |
| [`.agents/skills/shared/config.json`](.agents/skills/shared/config.json) | Project identity, stack, verification, providers (gitignored; fill via `configure-project`) |
| [`.agents/skills/shared/STACK.md`](.agents/skills/shared/STACK.md) | Human-readable stack companion |
| [`.agents/skills/shared/installed-skills.json`](.agents/skills/shared/installed-skills.json) | Managed skill list for `update` / `uninstall` |
| Upstream [README](https://github.com/jpolvora/workflow-skills#install-update-and-uninstall) | Human install narrative + catalog |

**Primary delivery:** `spec-to-pr` (thorough) or `spec-to-pr-lite` (fast). Optional: `fable-method`. After install/update: run `check-harness`; optionally `configure-project`.

**Project docs:** [`README.md`](README.md) · [`.agents/skills/shared/MEMORY.md`](.agents/skills/shared/MEMORY.md) · [`.agents/skills/shared/CHANGELOG.md`](.agents/skills/shared/CHANGELOG.md) (`rules.changelogFile`).

### How to use

1. Load the shared hub first for routing: [`.agents/skills/shared/AGENTS.md`](.agents/skills/shared/AGENTS.md).
2. Autoload Layer 0 from the hub (`caveman`, `gabarito`, `karpathy-guidelines`, plus `changelog` / `self-learning` on completion).
3. Invoke orchestrators by intent: `/spec-to-pr`, `/spec-to-pr-lite`, `/fable-method`, `/configure-project`, `/check-harness`, `/ship-pr`, `/fix-pr`, etc.
4. Expand path tokens (`{skillsRoot}`, `{sharedDir}`, `{plansDir}`) from `config.json` per `shared/tools.md` before file ops.
5. Never invent alternate pipeline folder ids; dispatch steps via the orchestrator (`00`–`09`, `goal-fix-pr`, `update-plan-implementation`).

### Install / update / uninstall

Prefer **npx**. Canonical package id: `github:jpolvora/workflow-skills` — do **not** append `@latest` or `@main`. Non-TTY / agents must pass `--yes`.

```bash
# Interactive install
npx --yes github:jpolvora/workflow-skills

# Non-interactive (exactly one mode)
npx --yes github:jpolvora/workflow-skills install --full --yes
npx --yes github:jpolvora/workflow-skills install --package workflows --yes
npx --yes github:jpolvora/workflow-skills install --skills spec-to-pr,goal-fix-pr --yes

# Update tracked skills (preserves shared/ consumer data)
npx --yes github:jpolvora/workflow-skills update
npx --yes github:jpolvora/workflow-skills update --include-new   # also add new upstream top-level skills

# Uninstall named skills (cascades unused deps; never deletes shared/ consumer data)
npx --yes github:jpolvora/workflow-skills uninstall --skills goal-fix-pr --yes

# Status / integrity
npx --yes github:jpolvora/workflow-skills --version
npx --yes github:jpolvora/workflow-skills --check
npx --yes github:jpolvora/workflow-skills integrity
npx --yes github:jpolvora/workflow-skills --help
```

**cursor-server default:** keep the **full** package (`install --full --yes`). Prefer `update` over re-installing unless the tree is corrupt.

| Preserved under `shared/` (never overwritten / never deleted by uninstall) |
|---|
| `config.json`, `STACK.md`, `MEMORY.md`, `memory/*`, `installed-skills.json`, `CHANGELOG.md` (when pointed by `rules.changelogFile`), `skill-integrity-local.json` |

**cURL shim** (same flags after `bash -s --`):

```bash
curl -fsSL https://raw.githubusercontent.com/jpolvora/workflow-skills/main/install-skills.sh | bash -s -- install --full --yes
curl -fsSL https://raw.githubusercontent.com/jpolvora/workflow-skills/main/install-skills.sh | bash -s -- update
curl -fsSL https://raw.githubusercontent.com/jpolvora/workflow-skills/main/install-skills.sh | bash -s -- uninstall --skills goal-fix-pr --yes
```

| Symptom | Fix |
|---------|-----|
| Exit 128 / `ssh://git@github.com/null/latest.git` | Drop `@latest` / `@main` |
| Interactive hang under a pipe | Use `install … --yes` |
| Integrity mismatch | Fix tree or regenerate upstream; `--force-integrity` is unsafe override only |

---

## Verification

Before claiming done on code changes:

```bash
npm run typecheck
npm run build
npm run scan-secrets   # before commit; husky runs this on git commit
curl http://localhost:3000/health   # when server running
```

Task endpoint smoke requires `CURSOR_API_KEY` and a clone under `repos/`. For **Code review proof**, resolve `rules.seniorDeveloper` per shared hub (optional local/global skill; not in the full package).

---

## Precedence

1. User explicit instructions (this file, direct requests)
2. [Shared hub](.agents/skills/shared/AGENTS.md) + invoked skills
3. Default agent behavior

Karpathy wins on diff size; project architecture / `senior-developer` (when configured) wins on structure.
