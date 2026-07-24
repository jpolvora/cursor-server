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
| **Now** | Local task API, scheduler hook, SDK integration, Docker Compose packaging, Tailscale bind/client access docs |
| **Next** | Client auth, repo validation |
| **Hermes** | Integration with [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) for orchestration, scheduling, and delegation to specialized coding agents |
| **Spec harness** | Hosted spec editor + qualified spec format; pipeline stages: **implement → build → test → deploy → review** |
| **Pluggable runners** | Harness abstraction so OpenCode, Hermes Agent, or Cursor SDK can execute the same spec pipeline |

The spec harness is the flagship long-term feature: authors write complete, machine-actionable specs in a served environment; the server executes them through specialized stage agents with full traceability from spec item to deploy artifact and review outcome.

## Status

Early scaffold. Implemented today:

- `GET /health` — liveness
- `POST /tasks` — run a one-shot local agent task against a named repo under `REPOS_ROOT`
- Job scheduler hook (no default jobs registered yet)

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

### `GET /health`

```json
{ "status": "ok" }
```

### `POST /tasks`

Run a prompt against a repo by name (relative to `REPOS_ROOT`).

**Request**

```json
{
  "prompt": "Review uncommitted changes for security issues",
  "repo": "my-app",
  "model": "composer-2"
}
```

**Response** `202 Accepted`

```json
{
  "agentId": "...",
  "runId": "...",
  "status": "finished",
  "durationMs": 12345,
  "result": "..."
}
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

**Auto-fix is disabled** (no `auto-fix.yml`).

**GitHub Actions secrets** (repo Settings → Secrets):

| Secret | Required for | Notes |
|--------|--------------|-------|
| `OPENCODE_API_KEY` | review | OpenCode Go; `run.sh` installs CLI + writes `auth.json` in CI |
| `AGENTIC_CODE_REVIEWERS_GITHUB_TOKEN` | optional | PAT with `repo` / PR write; `github.token` alone often cannot resolve threads |

Thread helpers live under [`.agents/skills/solve-pr/`](.agents/skills/solve-pr/) (vendored from the reviewer repo). Upstream docs: [workflows.md](https://github.com/jpolvora/agentic-code-reviewers/blob/main/docs/workflows.md).

Local dry-run:

```bash
curl -fsSL https://raw.githubusercontent.com/jpolvora/agentic-code-reviewers/release/run.sh | bash -s -- \
  --dry-run --gh --engine opencode --model opencode-go/deepseek-v4-flash
```

## License

Private — see repository owner.
