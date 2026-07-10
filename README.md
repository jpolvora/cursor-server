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
| **Docker / Docker Compose** | Primary packaging path; stack-friendly volume mounts for `repos/` and config |
| **Umbrel** | Install as a custom app or Compose stack on an Umbrel home server |
| **Bare metal / VM** | `npm run dev` or `npm start` on any Linux box with Node 20+ |

**Network access** via [Tailscale](https://tailscale.com): the server binds on the homelab LAN; home and company laptops reach it over the tailnet (VPN) without exposing ports to the public internet. No special client setup beyond Tailscale + the server URL.

> Docker Compose manifest and Umbrel app template are on the roadmap — not shipped yet.

## Roadmap

| Phase | Focus |
|-------|--------|
| **Now** | Local task API, scheduler hook, SDK integration |
| **Next** | Docker Compose stack, Tailscale-friendly defaults, client auth |
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

## License

Private — see repository owner.
