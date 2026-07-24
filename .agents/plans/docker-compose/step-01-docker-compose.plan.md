---
slug: docker-compose
title: "Docker Compose packaging for cursor-server"
status: "plan to be refined"
---

## 0. Summary & Business Rules

Ship a production-oriented Docker Compose stack so cursor-server runs on a home-lab host (Umbrel-friendly standard Compose or any Docker host) with:

1. Containerized Node 20+ API built from this repo (`node dist/index.js`).
2. Env via Compose `env_file` / environment (no secrets in image layers).
3. Persistent volume (or documented bind mount) for `REPOS_ROOT`.
4. Clear docs: build/up, env, volume mapping, Umbrel notes, Tailscale at host/network layer.

**Business rules**

- Secrets never baked into the image; placeholders only in samples.
- Repo clones live on a volume mapped to `REPOS_ROOT` inside the container.
- Bare-metal `npm run dev` / `npm start` / `typecheck` / `build` remain unchanged.
- Health endpoint is the post-`compose up` smoke check.
- No auth middleware, Tailscale deep-dive, repo-validation API, or image CI in this slice.

**Security mitigations**

- `.dockerignore` excludes `.env`, `repos/`, secrets.
- Compose injects `CURSOR_API_KEY` from host `.env` / env; never `COPY` `.env` into image.
- Prefer non-root runtime user; document volume permission caveats.

## 1. Definition of Ready & Scope

**Resolved assumptions**

- Host has Docker Engine + Compose v2 (`docker compose`).
- App already defaults `HOST=0.0.0.0` and `PORT=3000` in `src/config.ts`; no app code change required for AC6 unless a packaging bug forces it.
- Local Cursor SDK may need extra runtime deps inside the container; document known limits rather than invent unsupported packaging.
- Default published port 3000; named volume `repos_data` is the Compose default; bind mount `./repos:/data/repos` is documented alternative.
- Docker smoke (AC8) is manual when Docker is available; not required in CI this slice.
- Working branch: `develop` (`useWorktrees=false`).

**In scope**

| Artifact | Purpose |
|----------|---------|
| `Dockerfile` | Multi-stage production image |
| `.dockerignore` | Keep secrets/noise out of build context |
| `docker-compose.yml` | Service, ports, env, volume, restart |
| `docs/docker.md` | Operator guide (build/up, env, volumes, Umbrel, health) |
| `README.md` | Link Deployment → docs; remove “not shipped yet” |
| `.env.example` | Comments for container `REPOS_ROOT=/data/repos` |
| `.agents/specs/index.PRD` | Mark Phase 1 Docker Compose landed (hygiene) |

**Out of scope**

- Client API-key auth middleware (`client-auth.spec.md`).
- Tailscale-only networking deep-dive (`tailscale-homelab-docs.spec.md`).
- Repo path validation in the API (`repo-validation.spec.md`).
- Umbrel App Store manifest beyond Compose-friendly docs.
- CI that builds/pushes images.
- Async job queue, streaming, Hermes/OpenCode packaging.

**Acceptance Criteria (measurable)**

| ID | Criterion |
|----|-----------|
| AC1 | `Dockerfile` builds production image running `node dist/index.js` on Node 20+ after compile (multi-stage OK). |
| AC2 | Compose v3-compatible `docker-compose.yml` service `cursor-server`: port from `PORT` (default 3000), loads `CURSOR_API_KEY`, sets `REPOS_ROOT` to volume-backed path. |
| AC3 | Persistent named volume (or documented bind mount) for repo data; recreate does not wipe when using documented volume. |
| AC4 | Secrets not in image; from host env / `.env` / Compose patterns; `.env` gitignored; samples placeholders only. |
| AC5 | README and/or `docs/docker.md` (linked): build/up, env, host clone placement, Umbrel notes, Tailscale = host layer. |
| AC6 | Container `HOST=0.0.0.0` (default or Compose env); documented for Tailscale/LAN reach via published port. |
| AC7 | Host `npm run typecheck` and `npm run build` still pass; bare-metal `dev`/`start` path unbroken. |
| AC8 | Documented smoke: after `docker compose up`, `GET /health` → `{ "status": "ok" }` (manual OK). |

## 2. Technical Design & Architecture

**Stack (from `config.json` / `STACK.md`)**

- Backend: Node 20 + Hono + TypeScript ESM; layers `entry` / `config` / `routes` / `services` / `jobs`.
- Frontend / DB: none.
- Packaging is infrastructure-only; prefer **zero** `src/` edits. `loadConfig()` already supports `HOST`, `PORT`, `REPOS_ROOT`, `CURSOR_API_KEY`.

**Layer edits**

| Layer | Change |
|-------|--------|
| entry / config / routes / services / jobs | None expected |
| Packaging (new) | `Dockerfile`, `.dockerignore`, `docker-compose.yml` |
| Docs | `docs/docker.md`, `README.md` Deployment |
| Env sample | `.env.example` Compose comments |
| Index hygiene | `.agents/specs/index.PRD` checkboxes |

**Artifact design**

| File | Design |
|------|--------|
| `Dockerfile` | **builder:** `node:20-bookworm`, `npm ci`, `npm run build`. **runtime:** copy `package.json` + lock + prod deps + `dist/`, `EXPOSE 3000`, `CMD ["node","dist/index.js"]`, non-root `USER` if practical. Prefer bookworm over alpine (native/`@cursor/sdk` unknowns). |
| `.dockerignore` | `node_modules`, `dist`, `.env`, `.env.*`, `repos`, `.git`, `coverage`, `*.log`, `.agents/plans` optional noise |
| `docker-compose.yml` | Service `cursor-server`, `build: .`, `ports: ["${PORT:-3000}:3000"]`, `env_file: .env`, env overrides `HOST=0.0.0.0` + `REPOS_ROOT=/data/repos`, volume `repos_data:/data/repos`, `restart: unless-stopped` |
| Docs | `docs/docker.md` + README link; Umbrel = standard Compose + clear env + persistent volume; Tailscale on host |

**Data flow**

```text
Host .env → Compose env_file/environment → loadConfig() →
  listen HOST:PORT → agents cwd = {REPOS_ROOT}/{repo} on mounted volume
```

**Invariant checks (`config.json.invariants`)**

- `secretsFromEnvOnly` — no keys in Dockerfile/`COPY` of `.env`.
- `noHardcodedRepoAbsolutePaths` — app continues to resolve via `REPOS_ROOT` env.
- `localSdkRuntimeOnly` — Compose does not switch to cloud SDK runtime.
- `thinRoutesNoBusinessLogic` / `disposeAgentsAlways` / `settingSourcesEmptyUnlessIntentional` — unchanged.
- `commitPlanFilesOnlyAtStep8` — do not git-add `{plansDir}/` during implement.

### Fable domain (DevOps) — binding primary sources

`config.json.fable.enabled` + `autoDetectDomain` matched Docker signals. Apply [`fable-domain/references/devops.md`](../../skills/fable-domain/references/devops.md):

**Before Decide / edit of packaging files, inspect:**

1. Active packaging targets (will-be `Dockerfile`, `docker-compose.yml`) and any existing siblings (none today).
2. Env schema: `src/config.ts` + `.env.example` + `.gitignore` (`.env` ignored).
3. Validation outputs before claiming done: `docker compose config`, `docker compose build` (when Docker available), host `npm run typecheck` / `npm run build`.

**Forbidden inputs:** assumed live cluster/Umbrel state; inventing undocumented SDK binary packaging.

**Observation rules (DevOps verification)**

- Dry-run / validate: `docker compose config` exits 0; Compose shows service, port, `REPOS_ROOT`, volume.
- Build observation: `docker compose build` (or `docker build`) succeeds when Docker available.
- Runtime observation (manual AC8): container logs show listen without crashloop; `curl` `/health` → `{"status":"ok"}`.
- Secret observation: `.dockerignore` lists `.env`; image/samples contain placeholders only.

**Domain frauds to avoid**

1. Hardcoded credentials in Dockerfile/Compose.
2. Claiming Docker smoke passed without observation (or without documenting “Docker unavailable, skipped”).
3. Suppressing failure exit codes in any verify scripts (`|| true`).

## 3. Step-by-Step Plan

Ordered by dependency. Maps every spec requirement + child task.

### Step 1 — Build context hygiene (supports AC4)

- **Action:** Add root `.dockerignore` excluding `node_modules`, `dist`, `.env`, `.env.*` (keep allowing `.env.example` via ignore rules if needed), `repos/`, `.git`, coverage, logs, optional `.agents/plans`.
- **Files:** `.dockerignore` (new).
- **Check:** Build context does not include real secrets or host clones.
- **Maps:** AC4; Task Dockerfile (context safety).

### Step 2 — Production Dockerfile (AC1, AC4)

- **Action:** Multi-stage `Dockerfile`:
  - builder: Node 20 bookworm → `npm ci` → `npm run build` (`tsc` → `dist/`).
  - runtime: production `npm ci --omit=dev` (or equivalent), copy `dist/`, set `WORKDIR`, `EXPOSE 3000`, `CMD ["node","dist/index.js"]`.
  - Prefer non-root `USER`; if volume writes fail, document fallback (do not silently stay root without note).
- **Files:** `Dockerfile` (new).
- **Check:** `docker build -t cursor-server:local .` succeeds when Docker present; no `.env` in layers.
- **Maps:** AC1, AC4; Task Dockerfile. Spec note: document SDK limitations rather than invent packaging.

### Step 3 — Compose stack (AC2, AC3, AC6)

- **Action:** Add Compose file v3-compatible `docker-compose.yml`:
  - service name `cursor-server`
  - `build: .`
  - ports `${PORT:-3000}:3000` (container listens 3000; host maps `PORT`)
  - `env_file: .env` (and/or environment for required keys)
  - environment: `HOST=0.0.0.0`, `REPOS_ROOT=/data/repos` (override relative host default)
  - named volume `repos_data:/data/repos`
  - `restart: unless-stopped`
- **Files:** `docker-compose.yml` (new).
- **Check:** `docker compose config` validates; volume declared; `REPOS_ROOT` and `HOST` visible.
- **Maps:** AC2, AC3, AC6; Task docker-compose.yml.

### Step 4 — Env sample alignment (AC2, AC4, AC6)

- **Action:** Update `.env.example` comments: bare-metal `REPOS_ROOT=./repos`; Compose sets `/data/repos` via compose environment (do not put real keys). Keep placeholders (`cursor_...`).
- **Files:** `.env.example`.
- **Check:** Host defaults still clear; Compose path documented; `.env` still gitignored.
- **Maps:** AC2, AC4, AC6.

### Step 5 — Operator docs (AC5, AC6, AC8)

- **Action:** Add `docs/docker.md` covering: prerequisites, copy `.env`, `docker compose up -d --build`, where clones live (named volume inspect / bind-mount `./repos:/data/repos`), Umbrel custom-app notes (standard Compose, clear env, persistent volumes), Tailscale reachability at host/network (no public exposure assumed), SDK/`CURSOR_API_KEY` still required, smoke `curl http://localhost:3000/health`. Update README Deployment: link to `docs/docker.md`; remove “manifest … not shipped yet”; keep Tailscale one-liner (no deep-dive).
- **Files:** `docs/docker.md` (new), `README.md`.
- **Check:** Reader can build/up and smoke without reading the plan.
- **Maps:** AC5, AC6, AC8; Task Docs.

### Step 6 — Host verification (AC7)

- **Action:** Run `npm run typecheck` and `npm run build` on host. Confirm `npm run dev` / `npm start` paths unchanged (no package.json script breakage).
- **Files:** none expected under `src/`.
- **Check:** typecheck + build green.
- **Maps:** AC7.

### Step 7 — Optional Docker smoke (AC8) + index hygiene

- **Action:** If Docker available: `docker compose up -d --build`, curl `/health`, note recreate-volume persistence briefly. If unavailable: document skip in implement evidence (do not fake pass). Update `.agents/specs/index.PRD` Phase 1 Docker Compose checkboxes. Optionally set local gitignored `config.json` `stack.orchestration.composeCommand` to `docker compose` (do not commit `config.json`).
- **Files:** `.agents/specs/index.PRD`; optional local `config.json` only.
- **Check:** Health JSON when Docker exercised; index reflects packaging landed.
- **Maps:** AC3 (manual persist), AC8; Notes suggested composeCommand.

## 4. Permissions, Tenancy & i18n

| Area | Plan |
|------|------|
| RBAC / API auth | N/A (later `client-auth` spec) |
| Tenancy | N/A (single host / `REPOS_ROOT`) |
| i18n | N/A (API-only, no frontend) |
| Container user | Prefer non-root; ensure `/data/repos` writable by that user (named volume ownership). Document if root required for SDK. |

## 5. Test Coverage

Every AC maps to a named verification case. No new unit-test framework for YAML/Dockerfile (YAGNI). Method names are the stable IDs for implement/verify steps.

| AC | Test case / method | How |
|----|--------------------|-----|
| AC1 | `docker_image_runs_compiled_node_dist` | `docker compose build` (or `docker build`) succeeds; image CMD/`CMD` is `node dist/index.js`; Node 20 base. |
| AC2 | `compose_service_port_env_repos_root` | `docker compose config` shows service `cursor-server`, published port default 3000, `CURSOR_API_KEY` via env_file/env, `REPOS_ROOT=/data/repos` (or documented mount path). |
| AC3 | `repos_volume_survives_recreate` | Compose declares named volume (or docs show bind mount); manual: write file under mount, `docker compose up -d --force-recreate`, file still present. |
| AC4 | `secrets_not_in_image_or_samples` | `.dockerignore` excludes `.env`; `.gitignore` has `.env`; Dockerfile has no `COPY .env`; `.env.example` / Compose samples use placeholders only; optional `docker history` / layer inspect for absence of real keys. |
| AC5 | `docs_docker_linked_from_readme` | `docs/docker.md` exists with build/up, env, clone placement, Umbrel notes, Tailscale host-layer note; README Deployment links it and no longer claims Compose unshipped. |
| AC6 | `container_host_binds_all_interfaces` | Compose/env sets or preserves `HOST=0.0.0.0`; docs state clients use host Tailscale IP/LAN + published port. |
| AC7 | `host_typecheck_and_build_still_pass` | `npm run typecheck` && `npm run build` exit 0; `package.json` `dev`/`start` scripts unchanged in intent. |
| AC8 | `documented_health_smoke_after_compose_up` | Docs include curl `/health` expecting `{ "status": "ok" }`; when Docker available, live smoke confirms; else record skip with reason. |

## 6. Invariants (Do Not Violate)

From `config.json.invariants` + packaging rules:

| Invariant | Application |
|-----------|-------------|
| `localSdkRuntimeOnly` | Do not configure cloud SDK runtime in Compose/docs as default. |
| `secretsFromEnvOnly` | No real `CURSOR_API_KEY` in image, Dockerfile, or committed samples. |
| `noHardcodedRepoAbsolutePaths` | App keeps using `REPOS_ROOT`; only Compose sets container path `/data/repos`. |
| `thinRoutesNoBusinessLogic` | No drive-by route/service refactors. |
| `disposeAgentsAlways` | Do not touch agent lifecycle in this slice. |
| `settingSourcesEmptyUnlessIntentional` | Do not change `settingSources: []`. |
| `commitPlanFilesOnlyAtStep8` | Do not stage `.agents/plans/` during implement. |

**Fable DevOps observation (reiterated)**

- Validate with `docker compose config` / build before claiming packaging done.
- Do not assert live Umbrel/cluster state without observation.
- No hardcoded credentials; no `|| true` on verify commands.

**Surgical scope**

- Touch only packaging + docs (+ index hygiene). Prefer zero `src/` diffs.

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (packaging/docs only; no drive-by refactors).
- [ ] Domain entities and mappings encapsulated (N/A).
- [ ] Schema migrations created (N/A).
- [ ] Authorization checks applied (N/A — later spec).
- [ ] i18n keys declared (N/A).
- [ ] Test cases cover all ACs (section 5 methods AC1–AC8).
- [ ] `Dockerfile`, `docker-compose.yml`, `.dockerignore` present.
- [ ] README Deployment updated; `docs/docker.md` linked.
- [ ] `.env.example` Compose notes; `.env` still gitignored.
- [ ] `index.PRD` Docker Compose status updated.
- [ ] `npm run typecheck` && `npm run build` green.
- [ ] `npm run scan-secrets` clean before commit.
- [ ] Plan files not staged until Step 8.

## 8. Open Questions

Resolved for `autoMode=true` (implement may proceed without blocking):

1. **Bind mount vs named volume default?** → **Named volume `repos_data`** in Compose for Umbrel simplicity; document `./repos:/data/repos` bind mount for host-visible clones.
2. **Non-root vs SDK permissions?** → **Prefer non-root**; if SDK/volume writes fail, fall back and document (do not invent unsupported Cursor binary packaging).
3. **`composeCommand` in config?** → Document in `docs/docker.md`; optionally set local gitignored `config.json` `stack.orchestration.composeCommand=docker compose`; **do not commit** `config.json`.
4. **Port mapping consistency?** → Container process listens on 3000 (or `PORT` inside container if set); host publish `${PORT:-3000}:3000`. Keep Compose environment `PORT=3000` inside container unless docs explicitly sync both sides.

No blocking open questions for Step 2 (interview) under full auto; interview may skip if gate allows.
