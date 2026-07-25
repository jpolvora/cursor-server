---
id: null
slug: docker-compose
title: "Docker Compose packaging for cursor-server"
source: local
specDate: 2026-07-24
---

# Specification — Docker Compose packaging for cursor-server

## Description

Ship a production-oriented **Docker Compose** stack so cursor-server can run on a home-lab host (Umbrel-friendly Compose, or any Docker host) with:

1. A containerized Node 20+ API built from this repo.
2. Environment configuration via Compose `env_file` / environment (no secrets baked into images).
3. A **persistent volume** (or bind mount) for `REPOS_ROOT` so git clones survive container recreate.
4. Clear docs for Umbrel / custom Compose usage and how `REPOS_ROOT` maps into the container.

This is Phase 1 item 1 from `.agents/specs/index.PRD` (homelab-ready). It does **not** add client auth, Tailscale-specific networking beyond documenting bind defaults, repo validation logic, or async task queues (separate specs).

## Acceptance Criteria

- AC1: A `Dockerfile` builds a production image that runs `node dist/index.js` (or equivalent) on Node 20+, after compiling TypeScript in the image build (or a multi-stage build that emits `dist/`).
- AC2: A `docker-compose.yml` (Compose file v3-compatible) defines a `cursor-server` service that exposes the HTTP port from `PORT` (default 3000), loads required env (`CURSOR_API_KEY` at minimum), and sets `REPOS_ROOT` to a path inside the container that is backed by a named volume or documented bind mount.
- AC3: The Compose stack declares a persistent volume (or bind mount) for repository data; recreating the container does not wipe files under that mount when using the documented volume.
- AC4: Secrets are not copied into the image: `CURSOR_API_KEY` and other secrets come only from host env / `.env` / Compose secrets patterns; `.env` remains gitignored; image and Compose samples use placeholders only.
- AC5: README (or a short `docs/docker.md` linked from README) documents: how to build/up, required env vars, where to place repo clones on the host, Umbrel/custom-app notes (standard Compose, clear env, persistent volumes), and that Tailscale reachability is expected at the host/network layer (no public exposure assumed).
- AC6: `HOST` default inside the container remains suitable for container networking (`0.0.0.0`); documented so clients reach the published port via the host’s Tailscale IP or LAN.
- AC7: `npm run typecheck` and `npm run build` still pass on the host for the application sources; Compose/Docker files do not break the existing bare-metal `npm run dev` / `npm start` path.
- AC8: A smoke path is documented: after `docker compose up`, `GET /health` on the published port returns `{ "status": "ok" }` (verification may be manual on a machine with Docker; no requirement to run Docker in CI in this slice).

## Child Tasks

### Task — Dockerfile

- **Status:** todo
- **Description:** Multi-stage or single-stage production Dockerfile; Node 20+; install deps; build; run as non-root if practical without breaking local SDK needs.

### Task — docker-compose.yml

- **Status:** todo
- **Description:** Service, ports, env, volume for `REPOS_ROOT`, restart policy suitable for homelab.

### Task — Docs

- **Status:** todo
- **Description:** README Deployment section update and/or `docs/docker.md`; Umbrel-oriented notes; env and volume mapping.

## Notes

- **Index:** `.agents/specs/index.PRD` Phase 1 — Docker Compose stack.
- **Out of scope:** API key auth middleware (`client-auth.spec.md`); Tailscale-only docs deep-dive (`tailscale-homelab-docs.spec.md`); repo path validation in the API (`repo-validation.spec.md`); Umbrel App Store manifest beyond Compose-friendly docs; CI that builds/pushes images.
- **SDK constraint:** Local Cursor SDK runtime still requires a working agent environment inside the container; document any known limitations (e.g. Cursor binary / API key still required). Prefer documenting over inventing unsupported SDK packaging.
- **Invariants:** `secretsFromEnvOnly`, `noHardcodedRepoAbsolutePaths`, `localSdkRuntimeOnly`.
- **Suggested composeCommand:** consider setting `stack.orchestration.composeCommand` in local `config.json` after land (consumer-owned; do not commit `config.json`).
