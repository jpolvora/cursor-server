# Umbrel App Store packaging

cursor-server ships an **Umbrel App Store source layout** under [`deploy/umbrel/`](../deploy/umbrel/) alongside the existing root [`docker-compose.yml`](../docker-compose.yml). Both paths use the same `Dockerfile`, env contract, and volume semantics — Umbrel is distribution UX, not a second runtime.

## What is in `deploy/umbrel/`

| File | Purpose |
|------|---------|
| [`umbrel-app.yml`](../deploy/umbrel/umbrel-app.yml) | Store manifest (`manifestVersion: 1`) — id, metadata, port `3000` |
| [`docker-compose.yml`](../deploy/umbrel/docker-compose.yml) | Umbrel overlay: `app_proxy`, `${APP_DATA_DIR}` volumes, build from repo root |
| [`exports.sh`](../deploy/umbrel/exports.sh) | Optional `APP_PORT` export (no secrets) |

Manifest fields follow the current [getumbrel/umbrel-apps](https://github.com/getumbrel/umbrel-apps) layout (confirm schema at implement/submit time — fields drift).

## Install paths

### A — Standard Compose on Umbrel (unchanged)

If you already run custom Compose stacks on Umbrel, keep using the **root** compose file:

```bash
cp .env.example .env   # set CURSOR_API_KEY on the host
docker compose up -d --build
```

See [docker.md](./docker.md). No Umbrel App Store manifest required.

### B — Community App Store sideload (manifest path)

Use this when you want the app in the Umbrel UI with persistent `${APP_DATA_DIR}` paths.

1. Create a **public git repo** (community app store) with:

   ```text
   umbrel-app-store.yml          # store metadata; id/name of your store
   cursor-server/
     umbrel-app.yml              # copy from deploy/umbrel/umbrel-app.yml
     docker-compose.yml          # copy from deploy/umbrel/docker-compose.yml
     exports.sh                  # copy from deploy/umbrel/exports.sh (optional)
   ```

   Point `docker-compose.yml` `build.context` at a checkout that includes the repo root `Dockerfile` (the tracked file uses `context: ../..` relative to `deploy/umbrel/`; adjust if you flatten paths in your store repo).

2. In umbrelOS → **App Store → Community App Stores**, add your store URL.
3. Install **cursor-server**, then in app **Settings** set at minimum:
   - `CURSOR_API_KEY` (required)
   - Optional: `SERVER_API_KEY`, `TENANTS`, `CURSOR_MODEL`, `SCHEDULED_REVIEW_JOBS=true`
4. Open the app or `curl http://<umbrel-host>:3000/health` → `{"status":"ok"}`.

Secrets stay in Umbrel env / host `.env` — **never** in the image (see `.dockerignore`).

### C — Local smoke (compose overlay from clone)

From a full `cursor-server` clone:

```bash
export CURSOR_API_KEY=cursor_...
docker compose -f deploy/umbrel/docker-compose.yml up -d --build
curl http://localhost:3000/health
```

Uses the same build as root Compose; data dirs follow Umbrel `${APP_DATA_DIR}` when run under umbrelOS (for local smoke without Umbrel, set `APP_DATA_DIR` to a writable path).

## Non-goals (v1)

- Submitting or publishing to the official Umbrel store on your behalf
- Tailscale Funnel / public internet exposure
- Cloud Cursor SDK runtime
- Runtime dependency on Umbrel APIs when running bare-metal or root Compose

## Official store submission (future)

To propose inclusion in [getumbrel/umbrel-apps](https://github.com/getumbrel/umbrel-apps), copy `deploy/umbrel/*` into `cursor-server/` in a fork, pin a published multi-arch image digest (or document build context), add gallery assets per Umbrel linter, and open a PR. Track upstream manifest schema (`manifestVersion` 1 / 1.1 / 1.2) before submitting.
