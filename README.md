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

| Phase | Focus |
|-------|--------|
| **Now** | Local task API (incl. `agent` roles + `GET /agents`), scheduler hook, SDK integration, Docker Compose, Tailscale bind/client access docs |
| **Next** | Client auth, repo validation, then workflow-skills `spec-to-pr*` runner (soon) |
| **Hermes** | Integration with [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) for orchestration, scheduling, and delegation to specialized coding agents |
| **Spec harness** | MVP editor at `GET /ui/spec-editor` + qualified spec format landed; pipeline stages: **implement → build → test → deploy → review** (Hermes/OpenCode still open) |
| **Pluggable runners** | Harness abstraction so OpenCode, Hermes Agent, or Cursor SDK can execute the same spec pipeline |

The spec harness is the flagship long-term feature: authors write complete, machine-actionable specs in a served environment; the server executes them through specialized stage agents with full traceability from spec item to deploy artifact and review outcome.

## Status

Early scaffold. Implemented today:

- `GET /health` — liveness
- `GET /agents` — task role allowlist (`default`, `planner`, `implementer`, `plan+implementer`)
- `GET /ui/spec-editor` — hosted Markdown spec editor (validate / save / Save & Run)
- `POST /tasks` — run a local agent task against a named repo under `REPOS_ROOT` (optional `agent` / `model`)
- Job scheduler hook (no default jobs registered yet)
- Docker Compose packaging + Tailscale bind/client access docs

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

Run a prompt against a repo by name (relative to `REPOS_ROOT`).

**Request**

```json
{
  "prompt": "Review uncommitted changes for security issues",
  "repo": "my-app",
  "model": "composer-2",
  "agent": "default"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `prompt` | yes | Task text |
| `repo` | yes | Folder name under `REPOS_ROOT` |
| `model` | no | Override `CURSOR_MODEL` |
| `agent` | no | Role: `default` (generic), `planner`, `implementer`, `plan+implementer`. Unknown / missing → `default`. Alias: `generic` → `default`. |

**Agents**

| `agent` | Behavior |
|---------|----------|
| `default` | Single run with the prompt as-is (generic) |
| `planner` | Plan only (no implement instruction) |
| `implementer` | Implement-focused single run |
| `plan+implementer` | Plan phase, then implement using that plan |

**Response** `202 Accepted`

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

For `plan+implementer`, the body also includes a `plan` phase object alongside `run`.

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
