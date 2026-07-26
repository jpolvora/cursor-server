# cursor-server

API server that runs Cursor agents against local repository workspaces. Remote IDE clients delegate work via HTTP — prompts are executed on this host against checked-out repos under a configurable root directory.

Built on the [Cursor TypeScript SDK](https://cursor.com/docs/api/sdk/typescript) (`@cursor/sdk`) with a **local runtime**: agents run on the server machine with `cwd` set to the target repo.

## Vision

This server is the execution layer for a remote client IDE workflow:

- **Task delegation** — clients send prompts; the server runs Cursor agents in the appropriate local repo directory and returns run metadata and results.
- **Scheduled jobs** — cron-driven automation for recurring work (triage, hygiene, nightly reviews).
- **Continuous reviews** — deliver / deploy / exec review loops that keep remote clients aligned with repo state without running agents locally.
- **Spec-driven development** — a hosted spec editor and environment where fully qualified, detailed specifications drive an implementation harness end-to-end: implement → build → test → deploy → review. The harness is pluggable — Cursor SDK agents today, with room for other runners (e.g. [OpenCode](https://opencode.ai), [Hermes Agent](https://hermes-agent.nousresearch.com)).

Feature scope and API design are still open — see [AGENTS.md](./AGENTS.md) for architecture notes, roadmap, and conventions.

## Deployment

Designed for a **home lab** host — not cloud-first. Typical targets:

| Target | Notes |
|--------|--------|
| **Docker / Docker Compose** | Primary packaging path; see [docs/docker.md](./docs/docker.md) for build/up, env, and `repos` volume |
| **Umbrel** | Install as a custom app or Compose stack on an Umbrel home server (standard Compose; see docs) |
| **Bare metal / VM** | `npm run dev` or `npm start` on any Linux box with Node 20+ |

**Network access** via [Tailscale](https://tailscale.com): recommend `HOST=0.0.0.0` (bare-metal and Compose) so the published port is reachable on all interfaces. From a laptop on the same tailnet, call:

```text
http://<host-tailscale-ip-or-MagicDNS>:<PORT>
```

Example health check: `curl http://100.x.y.z:3000/health` (or your MagicDNS name). Public internet exposure is not assumed or required — Tailscale VPN is enough. No special client setup beyond Tailscale + that URL. Details: [docs/docker.md](./docs/docker.md#network--tailscale).

## Roadmap

| Phase | Focus | Status |
|-------|--------|--------|
| **Homelab-ready** | Docker Compose, Tailscale docs, client auth (`SERVER_API_KEY` / `TENANTS`), repo validation | **Landed** |
| **API depth** | Async tasks (`202` + poll), run history, SSE streaming, event gateway, scheduled review jobs | **Landed** (see caveats below) |
| **Spec harness** | Qualified spec schema, stage orchestration, spec editor UI, pluggable runners | **MVP landed** |
| **Runners** | Cursor SDK (default), Hermes (`hermes`), OpenCode (`opencode`) | **Registered** — CLIs must be installed |
| **Next** | workflow-skills `spec-to-pr*` exclusive server agent; WebSocket streaming; spec-editor aspirational UI | Open |

**Caveats (honest gaps):** Hermes/OpenCode adapters require external CLIs on PATH; health checks and CLI edge cases are still being hardened. MCP merge into live agent runs, multi-tenant isolation, task-streaming progress semantics, and scheduled-review robustness have open fix specs (`20`–`25` in `.agents/specs/`). See [AGENTS.md](./AGENTS.md) for the full remaining-gaps list.

The spec harness is the flagship long-term feature: authors write complete, machine-actionable specs in a served environment; the server executes them through specialized stage agents with full traceability from spec item to review outcome.

## Status

Homelab-ready API with spec harness MVP. Implemented today:

- `GET /health` — liveness
- `GET /agents` — task role allowlist (`default`, `planner`, `implementer`, `plan+implementer`)
- `GET /ui/spec-editor` — hosted Markdown spec editor (validate / save / Save & Run)
- `POST /tasks` — async task execution (default `async: true` → `202` + `taskId`; `async: false` for sync wait)
- `GET /tasks`, `GET /tasks/:id` — list / fetch task history (persisted under `REPOS_ROOT`)
- `GET /tasks/:id/stream` — SSE status and log output while a task runs
- `POST /events` — event gateway (Hermes/Umbrel/IDE → async task)
- `GET /jobs` — registered cron jobs + review execution history
- `POST /specs/validate`, `GET/PUT /repos/:repo/specs[/:file]` — qualified spec IO
- `POST /harness/runs` — stage pipeline (implement → build → test → review); runners: `cursor-local`, `cursor-sdk`, `hermes`, `opencode`
- Client auth — `SERVER_API_KEY` and/or `TENANTS` JSON; `X-API-Key` or `Authorization: Bearer` (disabled when neither is set)
- Repo validation — exist + git working tree checks before agent start
- Docker Compose packaging + Tailscale bind/client access docs
- Scheduled review jobs — `pr-diff-review` and `branch-sync-check` register at startup

## Prerequisites

- Node.js 20+
- [Cursor API key](https://cursor.com/dashboard/cloud-agents) (`CURSOR_API_KEY`)
- Local git clones under `REPOS_ROOT` (default: `./repos/<repo-name>`)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — set CURSOR_API_KEY and REPOS_ROOT
```

Place repositories the server should operate on:

```text
repos/
  my-app/      # git clone
  other-repo/
```

## Development

```bash
npm run dev
```

## API

### `GET /agents`

```json
{
  "agents": ["default", "planner", "implementer", "plan+implementer"],
  "default": "default",
  "aliases": { "generic": "default" }
}
```

### `GET /health`

```json
{ "status": "ok" }
```

### `GET /ui/spec-editor`

Interactive Markdown spec editor (no auth on the page). Lists/opens specs under a repo, live-validates via `POST /specs/validate`, saves to `{repo}/.agents/specs/`, and **Save & Run** dispatches `POST /harness/runs`. When `SERVER_API_KEY` is set, enter it in the page so API calls send `X-API-Key`.

### `POST /tasks`

Run a prompt against a repo by name (relative to `REPOS_ROOT`). **Async by default** (`async: true` → `202` with `taskId`; poll `GET /tasks/:id` or stream `GET /tasks/:id/stream`). Pass `async: false` for synchronous wait (legacy behavior).

**Request**

```json
{
  "prompt": "Review uncommitted changes for security issues",
  "repo": "my-app",
  "model": "composer-2",
  "agent": "default",
  "async": true,
  "webhookUrl": "https://example.com/hook",
  "source": "api"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `prompt` | yes | Task text |
| `repo` | yes | Folder name under `REPOS_ROOT` |
| `model` | no | Override `CURSOR_MODEL` |
| `agent` | no | Role: `default` (generic), `planner`, `implementer`, `plan+implementer`. Unknown / missing → `default`. Alias: `generic` → `default`. |
| `async` | no | Default `true` (`202` + background run). `false` = sync wait. |
| `webhookUrl` | no | POST completion payload when task finishes |
| `source` | no | `ide` \| `hermes` \| `umbrel` \| `api` (default `api`) |
| `mcpServers` | no | Per-task MCP server overrides (merged with global/repo config) |

**Auth:** When `SERVER_API_KEY` or `TENANTS` is configured, send `X-API-Key: <key>` or `Authorization: Bearer <key>`.

**Agents**

| `agent` | Behavior |
|---------|----------|
| `default` | Single run with the prompt as-is (generic) |
| `planner` | Plan only (no implement instruction) |
| `implementer` | Implement-focused single run |
| `plan+implementer` | Plan phase, then implement using that plan |

**Response** `202 Accepted` (async default)

```json
{
  "taskId": "task_...",
  "status": "pending",
  "repo": "my-app",
  "agent": "default",
  "createdAt": "2026-07-25T..."
}
```

**Response** `200 OK` (when `async: false`)

```json
{
  "agent": "default",
  "status": "finished",
  "durationMs": 12345,
  "run": {
    "agentId": "...",
    "runId": "...",
    "status": "finished",
    "durationMs": 12345,
    "model": "composer-2",
    "result": "..."
  },
  "result": "..."
}
```

For `plan+implementer`, the sync body also includes a `plan` phase object alongside `run`.

### `GET /tasks/:id/stream`

Server-Sent Events stream of `status`, `output`, and `done` events while a task runs.

### `POST /events`

Event gateway — same shape as task creation (`event`, `prompt`, `repo`, optional `agent`/`model`/`webhookUrl`, `source`). Returns `202` with `taskId`.

### `GET /jobs`

Lists registered cron jobs and recent review-job execution history.

### `GET /tasks/:id/stream`

Server-Sent Events stream for task lifecycle and live output.

**Auth** (when `SERVER_API_KEY` or `TENANTS` are configured): same as other protected routes — `X-API-Key`, `Authorization: Bearer <key>`, or query parameters `apiKey` or `access_token` (query form is required for browser `EventSource`, which cannot set custom headers).

**Events**

| Event | Payload | When |
|-------|---------|------|
| `status` | `{ id, status, result?, error? }` | On connect and on status change |
| `output` | `{ id, chunk }` | Worker lifecycle lines and agent run stream chunks |
| `done` | `{ id, status }` | Task reaches `completed`, `failed`, or `cancelled`; connection closes |

Example (Node / curl):

```bash
curl -N -H "X-API-Key: $SERVER_API_KEY" "http://localhost:3000/tasks/task_…/stream"
# EventSource in browser:
# new EventSource(`/tasks/${taskId}/stream?apiKey=${encodeURIComponent(key)}`)
```

## Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `CURSOR_API_KEY` | Cursor user or team service account key | — |
| `PORT` | HTTP listen port | `3000` |
| `HOST` | HTTP bind address | `0.0.0.0` |
| `REPOS_ROOT` | Directory containing repo clones | `./repos` |
| `CURSOR_MODEL` | Default model for local runs | `composer-2` |
| `SERVER_API_KEY` | Master API key for protected routes (`X-API-Key` or Bearer) | — (auth disabled when unset and no `TENANTS`) |
| `TENANTS` | JSON array of `{ id, apiKey, allowedRepos[] }` for multi-tenant scoping | — |
| `MCP_CONFIG_PATH` | Global MCP servers JSON (default `config/mcp.json`) | — |
| `HERMES_BIN` | Hermes CLI binary for `hermes` runner | `hermes` |
| `OPENCODE_BIN` | OpenCode CLI binary for `opencode` runner | `opencode` |
| `OPENCODE_API_KEY` | OpenCode API key (CI / agentic-code-reviewers) | — |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm run typecheck` | Type-check without emit |

## CI — Agentic Code Review

This repo consumes [jpolvora/agentic-code-reviewers](https://github.com/jpolvora/agentic-code-reviewers) via the portable `release/run.sh` runner (no submodule required).

| Workflow | File | Role |
|----------|------|------|
| **Agentic Code Review** | [`.github/workflows/code-review.yml`](.github/workflows/code-review.yml) | On PR: review with **opencode** / `opencode-go/deepseek-v4-flash`; fail if open bot threads remain |

**GitHub Actions secrets** (repo Settings → Secrets):

| Secret | Required for | Notes |
|--------|--------------|-------|
| `OPENCODE_API_KEY` | review | OpenCode Go; `run.sh` installs CLI + writes `auth.json` in CI |

Thread helpers: [`.agents/skills/ws-fix-pr/`](.agents/skills/ws-fix-pr/) and [`github-provider/scripts/`](.agents/skills/github-provider/scripts/) (e.g. `fetch_threads.cjs`). Upstream docs: [workflows.md](https://github.com/jpolvora/agentic-code-reviewers/blob/main/docs/workflows.md).

Local dry-run:

```bash
curl -fsSL https://raw.githubusercontent.com/jpolvora/agentic-code-reviewers/release/run.sh | bash -s -- \
  --dry-run --gh --engine opencode --model opencode-go/deepseek-v4-flash
```

## License

Private — see repository owner.
