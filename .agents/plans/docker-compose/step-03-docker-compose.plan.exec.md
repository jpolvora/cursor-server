---
slug: docker-compose
step: 3
title: "Execution plan — Docker Compose packaging"
execMode: parallel
planPath: .agents/plans/docker-compose/step-01-docker-compose.plan.md
dagPath: .agents/plans/docker-compose/step-03-docker-compose.exec.dag.json
status: ready
---

# Step 3 — Execution plan & DAG

## Size detection vs `dagThresholds`

| Metric | Counted from plan | Threshold | Within? |
|--------|-------------------|-----------|---------|
| Implementation steps | **6** (plan Steps 1–5 + 7; Step 6 is host verify folded into T6) | maxImplementationSteps: **3** | **NO** |
| Expected files | **7** (`.dockerignore`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `docs/docker.md`, `README.md`, `.agents/specs/index.PRD`) | maxExpectedFiles: **6** | **NO** |
| Layers | **2** (Packaging; Docs/env/index hygiene) — zero `src/` backend layers | maxLayers: **2** | YES (at limit) |

**Decision:** `execMode: **parallel**` — any exceeded metric forces parallel (steps and files both exceed).

Source plan: `.agents/plans/docker-compose/step-01-docker-compose.plan.md` (Step 2 interview skipped; refined plan not produced).

## Layer map

| Layer | Files | Tasks |
|-------|-------|-------|
| Packaging | `.dockerignore`, `Dockerfile`, `docker-compose.yml` | T1 → T3 → T4 |
| Docs / samples / hygiene | `.env.example`, `docs/docker.md`, `README.md`, `.agents/specs/index.PRD` | T2; T5; T6 |

No `src/` edits expected (plan + AGENTS packaging slice).

## DAG levels

Max 3 concurrent tasks/level. No shared files within a level.

```text
L0: T1 (.dockerignore) || T2 (.env.example)
L1: T3 (Dockerfile)          ← dependsOn T1
L2: T4 (docker-compose.yml)  ← dependsOn T3
L3: T5 (docs/docker.md, README.md) ← dependsOn T2, T4
L4: T6 (index.PRD + verify/smoke)  ← dependsOn T4, T5
```

| Level | Tasks | Files (disjoint) |
|-------|-------|------------------|
| L0 | T1, T2 | `.dockerignore` \| `.env.example` |
| L1 | T3 | `Dockerfile` |
| L2 | T4 | `docker-compose.yml` |
| L3 | T5 | `docs/docker.md`, `README.md` |
| L4 | T6 | `.agents/specs/index.PRD` |

## Tasks

### T1 — Build context hygiene
- **dependsOn:** none
- **files:** `.dockerignore`
- **ACs:** AC4 (context excludes secrets/clones)
- **Coder prompt:** Create root `.dockerignore` excluding `node_modules`, `dist`, `.env`, `.env.*` (keep `.env.example` usable), `repos/`, `.git`, coverage, logs, optional `.agents/plans`. No `src/` edits. No commit.

### T2 — Env sample alignment
- **dependsOn:** none
- **files:** `.env.example`
- **ACs:** AC2, AC4, AC6
- **Coder prompt:** Comment-only updates: bare-metal `REPOS_ROOT=./repos`; Compose sets `/data/repos` via compose env. Placeholders only. No `src/` edits. No commit.

### T3 — Production Dockerfile
- **dependsOn:** T1
- **files:** `Dockerfile`
- **ACs:** AC1, AC4
- **Coder prompt:** Multi-stage `node:20-bookworm` builder (`npm ci` + `npm run build`); runtime prod deps + `dist/`; `EXPOSE 3000`; `CMD ["node","dist/index.js"]`; prefer non-root `USER`; never `COPY .env`. Prefer bookworm over alpine. No `src/` edits. No commit.

### T4 — Compose stack
- **dependsOn:** T3
- **files:** `docker-compose.yml`
- **ACs:** AC2, AC3, AC6
- **Coder prompt:** Service `cursor-server`, `build: .`, ports `${PORT:-3000}:3000`, `env_file: .env`, env `HOST=0.0.0.0` + `REPOS_ROOT=/data/repos`, named volume `repos_data:/data/repos`, `restart: unless-stopped`. No hardcoded secrets. No `src/` edits. No commit.

### T5 — Operator docs
- **dependsOn:** T2, T4
- **files:** `docs/docker.md`, `README.md`
- **ACs:** AC5, AC6, AC8
- **Coder prompt:** Write `docs/docker.md` (prereqs, up/build, volumes, Umbrel, Tailscale host-layer, health smoke). Update README Deployment: link docs; remove “not shipped yet”; keep Tailscale one-liner. No `src/` edits. No commit.

### T6 — Index hygiene + verification
- **dependsOn:** T4, T5
- **files:** `.agents/specs/index.PRD`
- **ACs:** AC3 (manual persist note), AC7, AC8
- **Coder prompt:** Run host `npm run typecheck` + `npm run build`. If Docker available: `docker compose config` / `up -d --build` + curl `/health`; else record skip. Update `index.PRD` Phase 1 Docker Compose landed. Optional local-only `composeCommand` in gitignored `config.json` (do not commit it). Do not stage `.agents/plans/`. No `src/` edits. No commit.

## Plan step → task map

| Plan step | Task(s) |
|-----------|---------|
| Step 1 — `.dockerignore` | T1 |
| Step 2 — Dockerfile | T3 |
| Step 3 — docker-compose.yml | T4 |
| Step 4 — `.env.example` | T2 |
| Step 5 — docs + README | T5 |
| Step 6 — host typecheck/build | T6 (acceptance) |
| Step 7 — Docker smoke + index | T6 |

## Handoff

- Human-readable: `.agents/plans/docker-compose/step-03-docker-compose.plan.exec.md`
- Machine DAG: `.agents/plans/docker-compose/step-03-docker-compose.exec.dag.json`
- Next skill: `04-implement-tasks` with `execMode: parallel`
- Orchestrator: set state `execMode: parallel`
