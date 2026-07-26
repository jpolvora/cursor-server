---
slug: 14-spec-editor
step: 3
title: "Execution plan — Served Spec Editor & Interactive Environment"
execMode: sequential
planPath: .agents/plans/14-spec-editor/step-01-14-spec-editor.plan.md
dagPath: .agents/plans/14-spec-editor/step-03-14-spec-editor.exec.dag.json
status: ready
---

# Step 3 — Execution plan & DAG

## Size detection vs `dagThresholds`

| Metric | Counted from plan | Threshold | Within? |
|--------|-------------------|-----------|---------|
| Implementation steps | **3** (A Spec IO helpers → B Spec routes + harness resolve → C UI + wire + docs) | maxImplementationSteps: **3** | YES |
| Expected files | **6** core product paths (`spec-schema.ts`, `specs.ts`, `harness.ts`, `ui.ts`, `index.ts`, `spec-schema.test.ts`); route tests + README/AGENTS/`index.PRD` stay same-session sequential hygiene in T3/T2, not parallel split drivers | maxExpectedFiles: **6** | YES (at limit) |
| Layers | **2** (services, routes). `index.ts` entry is route-mount wiring only; docs/hygiene not stack layers | maxLayers: **2** | YES |

**Decision:** `execMode: sequential` — all metrics within `dagThresholds`. Dependency A → B → C and shared `src/index.ts` forbid useful parallel levels. No worktree split; run T1 → T2 → T3 in one session.

Source plan: `.agents/plans/14-spec-editor/step-01-14-spec-editor.plan.md` (Step 2 skipped; no refined plan).

## Layer map

| Layer | Files | Tasks |
|-------|-------|-------|
| services | `src/services/spec-schema.ts`, `src/services/spec-schema.test.ts` | T1 |
| routes (+ entry mount) | `src/routes/specs.ts`, `src/routes/harness.ts`, `src/routes/ui.ts`, `src/index.ts`, route tests, README/AGENTS/`index.PRD` | T2 → T3 |

## Sequential order

```text
T1 (spec IO helpers + unit tests) → T2 (spec GET/PUT + harness repo resolve + index mount) → T3 (UI route + docs hygiene + verify)
```

Machine DAG (`exec.dag.json`) records `execMode: sequential` with empty `tasks` / `levels` (threshold skip). Ordered tasks below guide Step 4.

## Tasks

### T1 — Spec file IO helpers (services)
- **dependsOn:** none
- **files:** `src/services/spec-schema.ts`, `src/services/spec-schema.test.ts`
- **ACs:** AC3 (safe write path foundation); traversal rejection for AC3 security
- **Maps plan:** Step A
- **Coder prompt:** In `src/services/spec-schema.ts` add `assertSafeSpecFilename`, `readRepoSpecFile`, `writeRepoSpecFile`. Confinement: resolved path must stay under `path.join(repoPath, '.agents', 'specs')` (basename allowlist; reject `..`, `/`, `\`). `writeRepoSpecFile` creates `.agents/specs` via `mkdirSync(..., { recursive: true })` and writes UTF-8. Extend `src/services/spec-schema.test.ts` for traversal rejection + round-trip write/read. Do not edit routes or UI yet. No commit. Reuse existing validate/list helpers; do not change QualifiedSpec Zod shape.

### T2 — Spec routes + harness repo-name resolution
- **dependsOn:** T1
- **files:** `src/routes/specs.ts`, `src/routes/harness.ts`, `src/index.ts`, `src/routes/harness.test.ts` (optional `src/routes/specs.test.ts`)
- **ACs:** AC2 (validate endpoint unchanged/regression), AC3 (PUT write + harness `{ repo }` resolve → 202 `runId`)
- **Maps plan:** Step B
- **Coder prompt:** On `createRepoSpecRoutes`: add `GET /repos/:repo/specs/:file` and `PUT /repos/:repo/specs/:file` (Zod `{ content: string }`) using T1 helpers + `validateRepoPath`. Prefer validate-then-write for Save; Save & Run path requires valid payload. Convert harness to `createHarnessRoutes(config)`: when `repoPath` absent and `repo` present, resolve via `validateRepoPath(config.REPOS_ROOT, repo)` → 400 if invalid; else keep prior `process.cwd()` default when both omitted. Mount factory from `src/index.ts` with existing `authMiddleware` on API routes. Extend `harness.test.ts` for `{ repo: name }` against temp `REPOS_ROOT`; add/extend specs route tests for PUT write + GET read + traversal 400. Thin routes only; no `@cursor/sdk` in routes. No UI yet beyond leaving room for T3 mount. No commit.

### T3 — UI route + docs hygiene + verify
- **dependsOn:** T2
- **files:** `src/routes/ui.ts`, `src/routes/ui.test.ts`, `src/index.ts`, `README.md` and/or `AGENTS.md`, `.agents/specs/index.PRD`
- **ACs:** AC1, AC2 (debounced validate via existing POST), AC3 (Save & Run UX)
- **Maps plan:** Step C + verify
- **Coder prompt:** Add `src/routes/ui.ts` with `GET /ui/spec-editor` (or mount prefix `/ui` + `/spec-editor`) returning self-contained Hono `c.html` + vanilla JS: repo field, optional API-key (sessionStorage → `X-API-Key` / Bearer), spec list (`GET /repos/:repo/specs`), open (`GET .../specs/:file`), debounced ~300ms validate (`POST /specs/validate`), Save (`PUT`), Save & Run (validate → PUT → `POST /harness/runs` with `{ spec, repo }`, show `runId`). Mount **without** auth. No React/Vite; no secrets hardcoded; UI never imports `@cursor/sdk`. Test: `ui.test.ts` asserts 200 `text/html` + editor markers. One-line README and/or AGENTS Architecture note; tick `index.PRD` item 14 / Phase 3 when landing (MEMORY packaging/docs sync). Run `npm run typecheck`, `npm test`, `npm run build`, `npm run scan-secrets`. Diff scope: planned files only (MEMORY docs-implement scope-creep guard). Do not stage `.agents/plans/`. No commit.

## Plan step → task map

| Plan step | Task(s) |
|-----------|---------|
| Step A — Spec file IO helpers | T1 |
| Step B — Spec routes + harness repo resolution | T2 |
| Step C — UI route + wire + docs hygiene | T3 |

## Invariants (do not violate)

- `localSdkRuntimeOnly` — UI/routes must not introduce cloud SDK
- `thinRoutesNoBusinessLogic` — IO in `spec-schema`; handlers validate + delegate
- `noHardcodedRepoAbsolutePaths` — always `validateRepoPath` / `REPOS_ROOT`
- `secretsFromEnvOnly` — never embed API keys in HTML
- `disposeAgentsAlways` / `settingSourcesEmptyUnlessIntentional` — unchanged; harness owns agents
- Surgical scope: no AC-builder, dependency graph, stage-config designer, auth redesign
- `commitPlanFilesOnlyAtStep8`
- MEMORY: keep README/AGENTS/`index.PRD` status consistent; no OOS `src/` churn

## Handoff

- Human-readable: `.agents/plans/14-spec-editor/step-03-14-spec-editor.plan.exec.md`
- Machine DAG: `.agents/plans/14-spec-editor/step-03-14-spec-editor.exec.dag.json` (sequential stub)
- Next skill: `ws-implement-tasks` with `execMode: sequential`
- Orchestrator: set state `execMode: sequential`
