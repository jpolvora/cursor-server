# cursor-server

API server that runs Cursor agents against local repository workspaces. Remote IDE clients delegate work via HTTP — prompts are executed on this host against checked-out repos under a configurable root directory.

Built on the [Cursor TypeScript SDK](https://cursor.com/docs/api/sdk/typescript) (`@cursor/sdk`) with a **local runtime**: agents run on the server machine with `cwd` set to the target repo.

## Vision

This server is the execution layer for a remote client IDE workflow:

- **Task delegation** — clients send prompts; the server runs Cursor agents in the appropriate local repo directory and returns run metadata and results.
- **Scheduled jobs** — cron-driven automation for recurring work (triage, hygiene, nightly reviews).
- **Continuous reviews** — foundation for deliver / deploy / exec review loops that keep remote clients aligned with repo state without running agents locally.

Feature scope and API design are still open — see [AGENTS.md](./AGENTS.md) for architecture notes and conventions while brainstorming.

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
