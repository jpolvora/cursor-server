---
slug: 40-main-page-dashboard
step: 3
title: "Execution plan — Main page dashboard shell"
execMode: sequential
planPath: .agents/plans/40-main-page-dashboard/step-02-40-main-page-dashboard.plan.refined.md
dagPath: .agents/plans/40-main-page-dashboard/step-03-40-main-page-dashboard.exec.dag.json
status: ready
---

# Step 3 — Execution plan & DAG

## Size detection vs `dagThresholds`

| Metric | Counted from refined plan (raw) | Threshold | Within? |
|--------|----------------------------------|-----------|---------|
| Implementation steps | **5** (plan Steps 1–5) | maxImplementationSteps: **3** | **NO** |
| Expected files | **7** (`board-db.ts`, `board-db.test.ts`, `settings.ts`, `settings.test.ts`, `dashboard-page.ts`, `dashboard.test.ts`, `index.ts`) | maxExpectedFiles: **6** | **NO** |
| Layers | **3** (services, routes, entry) — or **2** if entry counted as route-mount only | maxLayers: **2** | **NO** / borderline |

**Strict skill rule:** any exceeded metric → `parallel`.

**Override decision:** `execMode: **sequential**` anyway.

| Factor | Why sequential wins |
|--------|---------------------|
| Grouping | Raw Steps 1–5 collapse cleanly into **3 ordered tasks** (T1→T2→T3) with clear ownership. |
| Shared file | `src/index.ts` is touched by settings mount **and** `GET /` — parallel levels cannot share it without merge risk. |
| Host | `plans.useWorktrees: false` + win32 — orch prefers single-session sequential; parallel worktrees add no value. |
| Scope | Projects **stub only** (no 39 CRUD); no invented work beyond refined plan. |

Counted after grouping (for Step 4 guidance):

| Metric | After group | Threshold | Note |
|--------|-------------|-----------|------|
| Implementation steps | **3** (T1–T3) | 3 | At limit |
| Expected files | **7** | 6 | Still over — override documented |
| Layers | **2** (services → routes/entry) | 2 | At limit if entry = mount wiring |

Source plan: `.agents/plans/40-main-page-dashboard/step-02-40-main-page-dashboard.plan.refined.md`.

## Layer map

| Layer | Files | Tasks |
|-------|-------|-------|
| services | `src/services/board-db.ts`, `src/services/board-db.test.ts` | T1 |
| routes + entry | `src/routes/settings.ts`, `src/routes/settings.test.ts`, `src/routes/dashboard-page.ts`, `src/routes/dashboard.test.ts`, `src/index.ts` | T2 → T3 |

## Sequential order

```text
T1 (app_settings migration + seed + list/set) →
T2 (settings GET/PUT + auth mount on /settings) →
T3 (dashboard HTML shell + GET / + client auth/UX + dashboard tests + verify)
```

Machine DAG (`exec.dag.json`) records `execMode: sequential` with empty `tasks` / `levels` (DAG skip). Ordered tasks below guide Step 4.

## Tasks

### T1 — Domain & database (`app_settings`)
- **dependsOn:** none
- **files:** `src/services/board-db.ts`, `src/services/board-db.test.ts`
- **ACs:** AC6 (seed + SQLite persist)
- **Maps plan:** Step 1
- **Coder prompt:** In `src/services/board-db.ts`, append `CREATE TABLE IF NOT EXISTS app_settings (...)` to `MIGRATIONS` (do **not** invent schema_version bump machinery). After migrations on `init`, seed-if-missing these five keys via `INSERT OR IGNORE` (or select-then-insert) then `persist()`: `default_agent=default`, `default_harness_runner=cursor-local`, `ui_theme=dark`, `ui_density=comfortable`, `board_default_lane=backlog`. Add `listSettings(): Record<string,string>` and `setSettings(partial): Record<string,string>` on `BoardDatabase` (merge write + persist). Keep methods on the class — **do not** create `app-settings.ts`. Extend `board-db.test.ts`: init empty/temp DB → all five defaults present; set `ui_theme=light` → reopen/list still `light`. Follow existing singleton init/close / temp DB path pattern. Short test stubs only. No routes/UI yet. No commit.

### T2 — Settings API + protected mount
- **dependsOn:** T1
- **files:** `src/routes/settings.ts`, `src/routes/settings.test.ts`, `src/index.ts`
- **ACs:** AC2 (auth on settings), AC6 (GET/PUT persist)
- **Maps plan:** Step 2
- **Coder prompt:** Create `createSettingsRoutes(config)` in `src/routes/settings.ts`: `GET /` → `{ settings }` via `boardDb.listSettings()`; `PUT /` body `{ settings: Record<string,string> }` merge-patch allowlisted keys only (zod: max 256; enums — agent ∈ AGENTS, runner ∈ `cursor-local|cursor-sdk|hermes|opencode`, theme `dark|light`, density `comfortable|compact`, lane ∈ BOARD_LANES). Unknown key → 400; invalid enum → 400. Thin routes; persistence in board-db. In `src/index.ts`: `app.use("/settings", authMiddleware(config))`, `app.use("/settings/*", authMiddleware(config))`, `app.route("/settings", createSettingsRoutes(config))`. Do **not** add `GET /` dashboard yet (T3). Tests in `settings.test.ts` with `SERVER_API_KEY: "test-key"` or `"fake-board-key"` (MEMORY scan-secrets): missing key when auth on → 401; valid key GET includes defaults; PUT updates + GET reflects; unknown key → 400; invalid enum → 400. No dashboard HTML. No commit.

### T3 — Dashboard shell, root route, client UX, verify
- **dependsOn:** T2
- **files:** `src/routes/dashboard-page.ts`, `src/routes/dashboard.test.ts`, `src/index.ts`
- **ACs:** AC1–AC5, AC7, AC8 (+ AC2 UI markers)
- **Maps plan:** Steps 3–5
- **Coder prompt:** Create `src/routes/dashboard-page.ts` with `renderDashboardPageHtml()` — full document, board CSS tokens (`--bg`, `--panel`, `--accent #3d8bfd`, etc.; no purple/glow/marketing hero). Layout: login gate until `.authed`; left nav (Dashboard, Kanban board, Projects, Configuration) + `main#main-pane`; hash soft-nav `#dashboard` / `#projects` / `#config`; Kanban = navigate `window.location` / `<a href="/ui/board">` (no iframe; `#kanban` redirects to `/ui/board`). Client: KEY_STORAGE `cursor-server-api-key`; login + DOMContentLoaded auto-probe `GET /settings` with board-style `X-API-Key` + Bearer; 200 → reveal shell; 401 → single non-leaky “Invalid or missing API key”; logout clears storage + re-gates. Config pane: load/edit five settings → `PUT /settings`; apply `data-theme` / `data-density`. Projects pane **stub only**: `GET /board/repos` name list (optional muted `remote_url`); placeholder “Full create / edit / delete lands in 39-board-projects-management”; link to `/ui/board`; **no** add/edit/delete CRUD. Dashboard pane: welcome + links to `/ui/board`, `/ui/prompt`, `/ui/spec-editor`. Narrow viewport (`max-width: 720px`): collapsible nav. Wire `app.get("/", (c) => c.html(renderDashboardPageHtml()))` in `src/index.ts`; keep `/health` and `/ui/*` unchanged. `dashboard.test.ts`: GET `/` 200 `text/html` with login, menu labels, KEY_STORAGE, pane/nav markers, Kanban `/ui/board`, Projects stub/39 text, accent tokens; optional `/ui/board` still 200. Run `npm run typecheck`, `npm test`, `npm run build` (AC8). Do not invent 39 CRUD. Do not stage `.agents/plans/`. No commit.

## Plan step → task map

| Plan step | Task(s) |
|-----------|---------|
| Step 1 — Domain & Database | T1 |
| Step 2 — Application / Settings API | T2 |
| Step 3 — Dashboard HTML shell + root route | T3 |
| Step 4 — Client auth gate & UX polish | T3 (same module) |
| Step 5 — Verification suite | T3 (end of task) |

## Invariants (do not violate)

- `localSdkRuntimeOnly` — no cloud Agent / SDK in this feature
- `thinRoutesNoBusinessLogic` — persistence in `board-db`; zod at settings route OK
- `noHardcodedRepoAbsolutePaths` — `BOARD_DB_PATH` only
- `secretsFromEnvOnly` — never persist API keys in `app_settings`; short test stubs (`"test-key"` / `"fake-board-key"`)
- Projects stub only — no CRUD from spec 39
- Kanban navigates to `/ui/board` — no iframe
- Deep links `/ui/board`, `/ui/prompt`, `/ui/spec-editor` unchanged
- `commitPlanFilesOnlyAtStep8`
- Settings global host-level v1; preference store only (do not wire board/task consumers)

## Handoff

- Human-readable: `.agents/plans/40-main-page-dashboard/step-03-40-main-page-dashboard.plan.exec.md`
- Machine DAG: `.agents/plans/40-main-page-dashboard/step-03-40-main-page-dashboard.exec.dag.json` (sequential stub)
- Next skill: `ws-implement-tasks` with `execMode: sequential`
- Orchestrator: set state `execMode: sequential`
