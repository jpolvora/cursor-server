# Docker Compose — cursor-server

Run cursor-server on a home-lab Docker host (Umbrel-friendly standard Compose, or any Docker Engine + Compose v2).

## Prerequisites

- Docker Engine + Compose v2 (`docker compose`)
- A Cursor API key ([dashboard](https://cursor.com/dashboard/cloud-agents))
- Git clones the server should operate on (see [Repo data](#repo-data-volume))

## Quick start

```bash
cp .env.example .env
# Edit .env — set CURSOR_API_KEY (required). Host REPOS_ROOT=./repos is for bare-metal only.
docker compose up -d --build
curl http://localhost:3000/health
# Expect: {"status":"ok"}
```

Stop:

```bash
docker compose down
```

Compose command for this repo: `docker compose` (Compose v2 plugin).

## Environment

| Variable | In container | Notes |
|----------|--------------|--------|
| `CURSOR_API_KEY` | from `.env` via `env_file` | Required. Never bake into the image. |
| `HOST` | `0.0.0.0` (Compose override) | Bind all interfaces so published port is reachable. |
| `PORT` | `3000` inside container | Host publish uses `${PORT:-3000}:3000`. |
| `REPOS_ROOT` | `/data/repos` (Compose override) | Volume-backed; do not rely on bare-metal `./repos` inside the container. |
| `CURSOR_MODEL` | from `.env` if set | Default `composer-2`. |

`.env` stays on the host and is gitignored. The image build never `COPY`s `.env` (see `.dockerignore`).

## Repo data (volume)

Default Compose mounts a **named volume** `repos_data` at `/data/repos` (`REPOS_ROOT`).

- Clones live at `/data/repos/<repo-name>` inside the container.
- Recreating the container keeps data when using this named volume (`docker compose up -d --force-recreate`).
- Inspect volume contents: `docker volume inspect cursor-server_repos_data` (project prefix may vary), or `docker compose exec cursor-server ls /data/repos`.

### Bind-mount alternative (host-visible clones)

Replace the named volume with a bind mount so clones live under `./repos` on the host:

```yaml
volumes:
  - ./repos:/data/repos
```

Create `./repos` on the host first. Keep `REPOS_ROOT=/data/repos` in Compose environment.

## Umbrel / custom Compose notes

- Use **standard Compose** (`docker-compose.yml`); no Umbrel App Store manifest in this slice.
- Prefer clear env vars (host `.env` or Umbrel env UI) and a **persistent volume** for `/data/repos`.
- Publish port `3000` (or map host `PORT`) only on the LAN/tailnet interface you intend; do not assume public internet exposure.

## Network / Tailscale

Reachability is a **host/network** concern: clients use the homelab host’s Tailscale IP (or LAN IP) plus the published port. The container binds `HOST=0.0.0.0`; Compose publishes `${PORT:-3000}:3000`. No public exposure is assumed.

## SDK / runtime notes

- Local `@cursor/sdk` still needs a valid `CURSOR_API_KEY`.
- Image base is `node:20-bookworm` (plan/AC). `@cursor/sdk` may emit `EBADENGINE` wanting Node `>=22.13`; health smoke still works on Node 20. Bump base image later if SDK runtime requires it.
- The production image runs as a **non-root** user. If volume writes fail (permissions on a bind mount), fix host ownership of `./repos` or temporarily document a root fallback — do not invent unsupported Cursor binary packaging.
- Container packaging does not switch the app to cloud SDK runtime; agents still use local `cwd` under `REPOS_ROOT`.

## Health smoke

After `docker compose up -d --build`:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

Task smoke (`POST /tasks`) still needs a real API key and a clone under `REPOS_ROOT` (the volume).

## Bare metal (unchanged)

Compose does not replace host scripts:

```bash
npm run dev    # development
npm run build && npm start
```

See root [README.md](../README.md) for bare-metal setup.
