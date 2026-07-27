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
6. **Ops Kanban** — SQLite board data plane, `GET /ui/board`, Start/Pause/Finish for `spec-to-pr*`.
7. **Agent prompt widget** — `GET /ui/prompt` (standalone + embeddable).
8. **Unified ops console** — one shared shell (left menu, compact top bar, single main container) renders every view by route: `GET /` dashboard, `/ui/board`, `/ui/prompt`, `/ui/spec-editor`, `/ui/projects`, `/ui/config`. Login gate collects the API key once; host prefs via `GET`/`PUT /settings` (`app_settings` in board DB); Projects CRUD over `/board/repos` with soft-block delete when cards remain.
9. **Product website** — GitHub Pages static site (`website/`, `npm run deploy:pages`); release-triggered deploy from `master` via `.github/workflows/deploy-pages.yml`.

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
  index.ts              # Hono app entry, routes + scheduler; GET /agents; GET / HTML shell
  config.ts             # Env validation (zod); TENANTS parse
  agents.ts             # Task agent allowlist + resolveAgent (fallback → default)
  middleware/auth.ts    # SERVER_API_KEY / TENANTS / X-API-Key gate
  routes/
    health.ts           # GET /health
    shell.ts            # Shared app shell: design tokens (/ui/app.css), shell script (/ui/app.js), nav, renderShellPage
    dashboard-page.ts   # GET / dashboard view
    projects-page.ts    # GET /ui/projects — board repo CRUD view
    config-page.ts      # GET /ui/config — host preference view
    board-page.ts       # GET /ui/board — Kanban view + /ui/board-client.js
    settings.ts         # GET/PUT /settings — host preference store (API key auth)
    tasks.ts            # POST/GET /tasks; GET /tasks/:id/stream (SSE); GET /tasks/:id/ws (WebSocket)
    events.ts           # POST /events — event gateway
    jobs.ts             # GET /jobs — scheduler + review job history
    ui.ts               # /ui route table: view pages + app.css/app.js/*-client.js assets (public HTML)
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
    board-db.ts         # SQLite board + app_settings KV
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
| `spec-to-pr` | Drive installed `ws-spec-to-pr` skill in the target repo |
| `spec-to-pr-lite` | Drive installed `ws-spec-to-pr-lite` skill in the target repo |

List via `GET /agents`.

`GET /tasks/:id/stream` emits SSE `status`, `output`, and `done` events for async tasks. `GET /tasks/:id/ws` provides the same events over WebSocket (JSON frames). Auth accepts `X-API-Key`, `Authorization: Bearer`, or query `apiKey` / `access_token` (query form required for browser `EventSource` / `WebSocket`).

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

### Operator UI

New operator screens go through `renderShellPage()` in `src/routes/shell.ts` — never a standalone `<html>` page with its own palette.

- Design tokens live once in `APP_CSS` (`GET /ui/app.css`). Views ship only view-scoped CSS, and every selector must be nested under a view class so it cannot reach shell chrome.
- Add the route to `NAV_ITEMS` so the left menu and active state stay in sync; the shell marks `aria-current="page"` from `viewId`.
- Client scripts are served from their own `/ui/*-client.js` route and get the API key from `window.cursorServerAuth` (`key`, `headers`, `jsonHeaders`, `ready`). Do not add a per-page API key input — the shell login gate owns it. The embeddable prompt widget is the one exception, since it also runs outside the shell.
- Keep it compact and restrained: ~13px base type, hairline borders, no gradients, no glow shadows, no emoji chrome.

## SDK patterns to follow

| Pattern | When |
|---------|------|
| `Agent.prompt(...)` | True one-shots with no follow-up |
| `Agent.create()` + `agent.send()` + `run.wait()` | Streaming, multi-turn, or service lifecycle |
| `Agent.resume()` | Cross-process continuation (scheduled jobs, webhooks) |

Log `agentId` and `run.id` after `send()` in production paths.

## Roadmap (design intent)

Documented here so agents understand direction. **Shipped** items are summarized above; this section covers **remaining gaps** and runner operational caveats.

### Hermes integration (landed with caveats)

`HermesRunner` (`id: hermes`) is registered in `RunnerRegistry` and selectable via `runnerId` on harness runs. Hermes CLI invocation uses `HERMES_BIN` (default `hermes`). Scheduled review jobs and `POST /events` accept `source: hermes`.

**Caveats:** CLI must be installed and on PATH; health-check and CLI edge cases are tracked in fix specs (e.g. `20-fix-hermes-cli-and-health`). Hermes orchestration boundaries vs Cursor SDK per stage are still evolving.

### Spec editor & qualified-spec harness (MVP landed)

A **served spec editor/environment** where authors produce **fully qualified, complete specifications**. A harness executes each spec through stages:

```text
spec (qualified) → implement → build → test → review
```

(`deploy` is optional per spec frontmatter; default stage list omits it.)

**Landed:** `GET /ui/spec-editor`, QualifiedSpec parse/validate, stage orchestration, resumable runs (`POST /harness/runs`, stage store), and pluggable runners. Each stage is observable (logs, artifacts, pass/fail). Aspirational UI panels (AC builder, dependency graph, stage designer — spec `36`) shipped as progressive enhancement on the editor.

### Pluggable harness abstraction (landed)

Pipeline logic is behind `HarnessRunner` + `RunnerRegistry`; do not hard-couple new stages to `@cursor/sdk` directly.

| Runner | `id` | Status |
|--------|------|--------|
| **Cursor SDK** | `cursor-local`, `cursor-sdk` | Default; local `cwd` runs |
| **Hermes Agent** | `hermes` | CLI adapter registered; see caveats above |
| **OpenCode** | `opencode` | CLI adapter registered; requires `opencode` on PATH / `OPENCODE_BIN` |

New runners plug in via `runnerRegistry.register()` behind the same spec → stage → outcome contract.

## Planned areas (remaining gaps)

Living feature map: [`.agents/specs/index.PRD`](./.agents/specs/index.PRD). Confirm major new items with the owner before expanding scope:

Shipped recently (do not re-open as gaps): GitHub Pages product website (`41`), Board projects management (`39` — dashboard Projects CRUD, soft-block delete), root ops dashboard shell (`40` — `GET /`, `GET`/`PUT /settings`, `app_settings`), Umbrel App Store manifest (`38` — `deploy/umbrel/`, docs/umbrel.md), WebSocket streaming (`37`), spec-editor aspirational UI (`36` — AC builder, dependency graph, stage designer), Kanban board (`32`–`34`), agent prompt widget (`35`), scheduled review jobs (`25` — hygiene scan, `SCHEDULED_REVIEW_JOBS` gate, `Agent.resume`), MCP merge (`23`), multi-tenant ACL (`22`), SSE progress/auth (`24`), Hermes CLI/health (`20`), OpenCode stream/git (`21`), harness default stages (`26`), frontmatter stages (`27`), `spec-to-pr*` agent roles (`05`).

Next (not done): Richer MCP diagnostics remains Inbox-only until a concrete gap appears.

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
- Do not expand beyond Next specs / Inbox without explicit owner go-ahead — but **do** keep README/AGENTS/`index.PRD` updated when shipped code or vision changes. Prefer `/ws-spec-index` for feature-map edits.

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

**Primary delivery:** `ws-spec-to-pr` (thorough) or `ws-spec-to-pr-lite` (fast). Optional: `ws-fable-method`. After install/update: run `ws-check-harness`; optionally `ws-configure-project`.

**Project docs:** [`README.md`](README.md) · [`.agents/skills/shared/MEMORY.md`](.agents/skills/shared/MEMORY.md) · [`.agents/skills/shared/CHANGELOG.md`](.agents/skills/shared/CHANGELOG.md) (`rules.changelogFile`).

### How to use

**Portable contract:** this root `AGENTS.md` is the single source of truth for skill autoload and completion gates. It applies to any agent host that reads project instructions (Cursor, OpenCode, Antigravity, VS Code Copilot, Claude Code, Codex, etc.). Do **not** rely on IDE-vendor rule folders (e.g. `.cursor/rules`) for these gates.

1. Load the shared hub first for routing: [`.agents/skills/shared/AGENTS.md`](.agents/skills/shared/AGENTS.md).
2. **Autoload every prompt (Layer 0):** `ws-caveman`, `ws-gabarito`, `ws-karpathy-guidelines` from the hub (paths under `.agents/skills/`).
3. **Plan-first gate (default):** When a free-text task involves several files or multiple modifications, pause before coding. Confirm a short plan with the user and whether to add/update specs, run [`ws-spec-index`](.agents/skills/ws-spec-index/SKILL.md), [`ws-sync-spec`](.agents/skills/ws-sync-spec/SKILL.md), `/ws-spec-to-pr` / `/ws-spec-to-pr-lite`, or `/ws-fable-method`. Prefer workflows and specs/planning over immediate implementation. Layer 0 still applies every prompt. **Skip the pause** when scope is clearly trivial (single file / tiny fix) or the user gave an explicit implement/ship command or named a workflow to run. This root `AGENTS.md` is the single source of truth for the gate; do not add a separate always-on skill that duplicates it.
4. **Autoload after implementation / vibe-coding turns:** [`ws-sync-spec`](.agents/skills/ws-sync-spec/SKILL.md) — keep matching `.agents/specs/*.spec.md` aligned with code; propose updates and **wait for approval** before writing. If no matching spec, report and continue.
5. **On demand (this repo):** [`cursor-server`](.agents/skills/cursor-server/SKILL.md) — local coding conventions and feature/config workflows when implementing in this codebase.
6. Invoke orchestrators by intent: `/ws-spec-to-pr`, `/ws-spec-to-pr-lite`, `/ws-fable-method`, `/ws-configure-project`, `/ws-check-harness`, `/ws-ship-pr`, `/ws-fix-pr`, etc.
7. Expand path tokens (`{skillsRoot}`, `{sharedDir}`, `{plansDir}`) from `config.json` per `shared/tools.md` before file ops.
8. Never invent alternate pipeline folder ids; dispatch steps via the orchestrator (`00`–`09`, `goal-fix-pr`, `update-plan-implementation`).
9. **Mandatory completion gate (every task ready):** `ws-sync-spec` → `self-learning` → `changelog`.
10. **On-demand only (not every vibe turn):** [`ws-spec-index`](.agents/skills/ws-spec-index/SKILL.md) for ship/delivery (`sync`), Inbox → planned (`promote`), or index bootstrap (`init`). Use when editing `index.PRD` / README Roadmap / AGENTS Planned areas — not for AC content drift (that is `ws-sync-spec`).

### Install / update / uninstall

Prefer **npx**. Canonical package id: `github:jpolvora/workflow-skills` — do **not** append `@latest` or `@main`. Non-TTY / agents must pass `--yes`.

```bash
# Interactive install
npx --yes github:jpolvora/workflow-skills

# Non-interactive (exactly one mode)
npx --yes github:jpolvora/workflow-skills install --full --yes
npx --yes github:jpolvora/workflow-skills install --package workflows --yes
npx --yes github:jpolvora/workflow-skills install --skills ws-spec-to-pr,ws-goal-fix-pr --yes

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

1. User explicit instructions (this root `AGENTS.md`, direct requests) — portable across agent hosts; do not require IDE-specific rule files. Includes the § How to use **plan-first gate** for multi-file free-text work unless the user explicitly overrides.
2. [Shared hub](.agents/skills/shared/AGENTS.md) + invoked skills under `.agents/skills/`
3. Default agent behavior

Karpathy wins on diff size; project architecture / `senior-developer` (when configured) wins on structure.
