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
- **Packaging**: Docker Compose is the production path (`Dockerfile`, `docker-compose.yml`, [docs/docker.md](./docs/docker.md)).

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
- Do not implement roadmap items (spec editor, Hermes, Umbrel App Store manifest) without explicit owner go-ahead — but **do** keep README/AGENTS roadmap sections updated when vision changes.

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
