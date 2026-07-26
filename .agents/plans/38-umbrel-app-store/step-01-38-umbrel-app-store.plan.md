# Plan — 38-umbrel-app-store

## Approach

1. Add `deploy/umbrel/` with `umbrel-app.yml` (manifestVersion 1), `docker-compose.yml` (app_proxy + build from repo root), `exports.sh`.
2. Document install paths in `docs/umbrel.md`; link from README and `docs/docker.md`.
3. Leave root `docker-compose.yml` and bare-metal path unchanged.
4. Sync roadmap docs (README, AGENTS.md, index.PRD).

## Verification

- `npm run typecheck`
- `npm run build`
