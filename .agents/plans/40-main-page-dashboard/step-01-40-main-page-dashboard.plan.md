---
slug: 40-main-page-dashboard
title: "Main page dashboard shell (root UI, login, left menu, SaaS layout)"
status: "plan to be refined"
complexity: complex
orch_note: "complex — UI shell + client auth gate + SQLite settings + protected APIs; exceeds dagThresholds (steps/files/layers). Prefer ws-spec-to-pr full path, not lite."
---

## 0. Summary & Business Rules

**Objective:** Make `GET /` the primary operator entry for cursor-server. Unauthenticated browsers see a login dialog (API key / tenant key). Authenticated operators get a lightweight SaaS shell: left nav + center pane that swaps by menu selection (Dashboard, Kanban, Projects stub, Configuration).

**Business rules:**
1. Root shell is public HTML (same pattern as `/ui/*`); protected data/APIs stay behind existing `authMiddleware` (`SERVER_API_KEY` / `TENANTS` via `X-API-Key`, Bearer, or query).
2. Client stores the key in `sessionStorage` under `cursor-server-api-key` (reuse board / prompt / spec-editor convention). No new secret storage in DB or files.
3. Config values persist server-side in SQLite (`BOARD_DB_PATH`, default `./data/board.db`) so operators share settings on the homelab host; not localStorage-only.
4. Deep links `/ui/board`, `/ui/prompt`, `/ui/spec-editor` must keep working unchanged.
5. **Projects decision (AC5):** **Stub only.** Do **not** implement create/edit/delete CRUD here. Show a read-only list of existing board repos via `GET /board/repos` when authenticated, plus a clear placeholder that full project management ships with `39-board-projects-management`, and a link to `/ui/board`. Documented for implementers and orch: scope stops at stub UX.

**Security mitigations:**
- Login probe must hit a protected endpoint; failed auth returns generic non-leaky error (reuse middleware `"Invalid API key"` / `"Missing authentication credentials"`; UI shows a single user-facing message).
- Settings APIs require `authMiddleware`; never accept or persist API keys / env secrets as setting values.
- Config keys are allowlisted (zod); reject unknown keys and oversized values.
- MEMORY: test stubs for API keys must stay short (`"test-key"`) so `scan-secrets` does not false-positive.

**Design bar:** Calm dark ops UI aligned with existing board CSS variables (`--bg`, `--panel`, `--accent` blue, not purple). No glow stacks, pill clutter, marketing hero, or card-everywhere layout. Collapsible left nav on narrow viewports.

## 1. Definition of Ready & Scope

### Resolved assumptions
| # | Assumption |
|---|------------|
| A1 | Serve shell at app root `GET /` (not only under `/ui`) so `http://localhost:3000/` is useful. |
| A2 | HTML/CSS/JS follows existing inline/`c.html` patterns in `src/routes/ui.ts` (and extracted page modules like `prompt-widget.ts` / `spec-editor-page.ts`). No new SPA framework. |
| A3 | Settings live in the same sql.js board DB (`boardDb` / `BOARD_DB_PATH`); add an `app_settings` table via migration. |
| A4 | Projects CRUD deferred to `39`; this plan ships stub list + placeholder + link only. |
| A5 | Auth gate is client-side reveal of shell chrome after successful probe; HTML document itself remains publicly fetchable (like `/ui/board`). Protected APIs enforce auth. |
| A6 | When `SERVER_API_KEY` unset and `TENANTS` empty, middleware allows anonymous; login can treat empty key / skip as success for local-dev (match current API behavior). |

### Acceptance Criteria (measurable)
| AC | Measurable outcome |
|----|--------------------|
| AC1 | `GET /` → `200` `text/html` with login UI; accepts same credential shapes as API. |
| AC2 | Valid key reveals dashboard chrome; invalid key shows error and keeps protected panes gated. |
| AC3 | Left menu + main container; menu selection updates main pane without losing chrome. |
| AC4 | Menu: Dashboard, Kanban board, Projects, Configuration; Kanban navigates to or embeds `/ui/board`. |
| AC5 | Projects: stub list (+ placeholder/link to 39 / `/ui/board`); no full CRUD. |
| AC6 | Configuration key/value editor; documented seeded defaults; persist across reload via SQLite. |
| AC7 | Restrained CSS variables; desktop + usable narrow (collapsible menu); anti-slop checklist. |
| AC8 | Typecheck, build, route/UI tests for `GET /`, auth on settings APIs, config seed; no Cursor cloud. |

### Out of scope
- Board lane/execution changes (`34`).
- Spec-editor rewrite (`36`).
- Projects CRUD / modals (`39`).
- OAuth / public marketing landing.
- New secret storage or env key management UI.
- Changing auth middleware contract.

### Complexity (orch)
**complex** — multi-layer (routes + services/SQLite + public HTML shell + auth probe + tests). Expect ~8–12 files touched; sequential DAG skip thresholds exceeded. Use full `ws-spec-to-pr`, not lite.

## 2. Technical Design & Architecture

### Stack layers (from config.json)
| Layer | Path | Change |
|-------|------|--------|
| entry | `src/index.ts` | Mount `GET /` dashboard HTML; mount protected `/settings` routes with `authMiddleware`. |
| config | `src/config.ts` | No new secrets. Reuse `BOARD_DB_PATH`. (No new env keys required.) |
| routes | `src/routes/` | New dashboard page module + settings API route; extend `ui.test.ts` / add tests. |
| services | `src/services/board-db.ts` (+ optional thin `app-settings.ts` helpers) | Migration + get/set/list settings + seed defaults. |
| jobs | — | No change. |

**Frontend:** none in config; UI is server-rendered HTML + vanilla JS (existing pattern).

### Fable / Ops domain (light)
`fable.enabled` + `autoDetectDomain`: this feature is **Ops** (homelab operator console), with SQLite persistence signal.

| Binding primary sources (before Decide/implement) | Observation |
|---------------------------------------------------|-------------|
| `src/middleware/auth.ts`, `src/routes/ui.ts` (KEY_STORAGE), `src/services/board-db.ts` migrations, `BOARD_DB_PATH` | `npm run typecheck` / `build`; `GET /` HTML; settings GET after seed; 401 without key when auth enabled |
| Do not invent secret columns or localStorage-only “done” for AC6 | |

Ops frauds to avoid: claiming Projects CRUD done via stub; claiming persistence via sessionStorage only; embedding real API keys in tests.

### Auth approach
1. **Public:** `GET /` returns HTML shell always.
2. **Client:** Login field + optional “Remember for this tab” via `sessionStorage.setItem("cursor-server-api-key", key)` (same key as board UI).
3. **Probe:** After submit, `fetch` a protected settings endpoint (e.g. `GET /settings`) with `X-API-Key: <key>`. `200` → show shell; `401` → show non-leaky error (“Invalid or missing API key”).
4. **Subsequent UI calls:** Attach `X-API-Key` from sessionStorage (board pattern in `ui.ts` ~lines 274–283).
5. **Anonymous mode:** If probe returns `200` without key (auth disabled), enter dashboard without forcing a key.

Do **not** add a separate cookie session server; reuse existing key header model.

### SQLite storage
**Location:** same file as board data plane: `config.BOARD_DB_PATH` (default `./data/board.db`).

**Migration** (append to `MIGRATIONS` in `board-db.ts`; bump logical schema note if version row used):

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Seed defaults** (insert-if-missing on init after migrations):

| Key | Default | Purpose |
|-----|---------|---------|
| `default_agent` | `default` | Default task agent role (`AGENTS` allowlist). |
| `default_harness_runner` | `cursor-local` | Default harness runner id. |
| `ui_theme` | `dark` | Shell theme preference (`dark` \| `light`). |
| `ui_density` | `comfortable` | UI density (`comfortable` \| `compact`). |
| `board_default_lane` | `backlog` | Board-related preference (new cards / filter default). |

Allowlist these keys in zod on PUT; reject unknown keys with `400`. Values are plain strings (no secrets). Optional: validate `default_agent` against `AGENTS` and `default_harness_runner` against known runner ids when updating.

### API surface
| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `GET` | `/` | public | Dashboard HTML shell. |
| `GET` | `/settings` | protected | `{ settings: Record<string,string> }` (all keys, after seed). |
| `PUT` | `/settings` | protected | Body `{ settings: { key: value, ... } }` merge-update allowlisted keys; return updated map. |
| (reuse) | `GET /board/repos` | protected | Projects stub list (existing). |

Thin routes → service methods on `boardDb` (or small wrapper).

### HTML / CSS approach
- New module `src/routes/dashboard-page.ts`: `renderDashboardPageHtml()` returning full document string (mirror `renderPromptPageHtml` / `renderSpecEditorPageHtml`).
- Wire in `src/index.ts`: `app.get("/", (c) => c.html(renderDashboardPageHtml()))` **before** or alongside health (health stays `/health`; do not break `/health`).
- Layout: `aside.nav` + `main#pane`; hash or `data-view` soft navigation (`#dashboard`, `#kanban`, `#projects`, `#config`).
- **Kanban (AC4):** Prefer **link / soft-nav that sets `window.location` to `/ui/board`** OR iframe embed of `/ui/board` inside main pane. **Recommendation:** primary menu action = navigate to `/ui/board` (preserves full board UX); optional secondary “Open in pane” iframe is nice-to-have, not required if deep link works. Document choice in implement notes: **navigate to `/ui/board`** as default to avoid double-chrome and auth-input duplication.
- CSS: `:root` variables matching board palette; single composition; `@media (max-width: 720px)` collapse nav to top drawer/hamburger.
- Anti-slop: no purple gradient theme, no box-shadow glow stacks, no chip rows.

### Projects stub (AC5) — explicit
```
Projects pane:
  - Heading: Projects
  - Body: fetch GET /board/repos → render name list (read-only)
  - Empty or always-visible note: "Full create / edit / delete lands in 39-board-projects-management."
  - Link: "Open Kanban board" → /ui/board
  - Disable or omit add/edit/delete buttons (or show disabled with title="Coming in spec 39")
```
Do not invent a parallel projects table in this slug.

### Exact files to create / modify

| Action | File |
|--------|------|
| **Create** | `src/routes/dashboard-page.ts` — HTML/CSS/JS shell (login, nav, panes, config editor client). |
| **Create** | `src/routes/settings.ts` — `createSettingsRoutes()` GET/PUT. |
| **Create** | `src/routes/settings.test.ts` — auth + seed + update. |
| **Create** | `src/routes/dashboard-page.test.ts` **or** extend `src/routes/ui.test.ts` — `GET /` HTML assertions (prefer small `dashboard.test.ts` mounted like production). |
| **Modify** | `src/services/board-db.ts` — `app_settings` migration, seed, `listSettings` / `getSetting` / `setSettings`. |
| **Modify** | `src/services/board-db.test.ts` — seed + persist roundtrip. |
| **Modify** | `src/index.ts` — `GET /` + `authMiddleware` + `/settings` route. |
| **Modify** | `README.md` and/or `.agents/specs/40-main-page-dashboard.spec.md` only if ship step requires doc sync (implement may note; Step 4 keeps docs minimal unless AC demands). Prefer updating feature spec status via later sync, not inventing README scope here. |
| **Optional thin helper** | `src/services/app-settings.ts` only if board-db would become too large; default = keep methods on `BoardDatabase`. |

**Do not modify:** board execution, lane logic, Hermes/OpenCode runners, auth middleware semantics (only reuse).

### Invariant checks
- `thinRoutesNoBusinessLogic`: settings validation/persistence in service.
- `secretsFromEnvOnly`: settings values never store API keys; secrets remain env / `secret_ref`.
- `noHardcodedRepoAbsolutePaths`: N/A for paths; use `BOARD_DB_PATH` from config.
- `localSdkRuntimeOnly`: no SDK calls in this feature.
- `commitPlanFilesOnlyAtStep8`: this plan file is an artifact; commit at delivery.

## 3. Step-by-Step Plan

Ordered by dependency. Each step: action → files → check.

### Step 1 — Domain & Database
- Add `app_settings` migration + seed-if-missing for the five default keys.
- Add `listSettings(): Record<string,string>`, `setSettings(partial: Record<string,string>): Record<string,string>` (persist after write).
- **Files:** `src/services/board-db.ts`, `src/services/board-db.test.ts`
- **Check:** unit test: init empty DB → defaults present; set `ui_theme=light` → reopen/list still `light`.

### Step 2 — Application / Settings API
- `createSettingsRoutes(config)` with zod body schema (allowlist keys, string values, max length ~256).
- Wire `app.use("/settings", authMiddleware(config))` + `app.use("/settings/*", …)` + `app.route("/settings", …)`.
- **Files:** `src/routes/settings.ts`, `src/routes/settings.test.ts`, `src/index.ts`
- **Check:** with test config key → `GET /settings` 200 includes defaults; without key when auth on → 401; `PUT` updates and `GET` reflects (MEMORY: `SERVER_API_KEY: "test-key"`).

### Step 3 — Dashboard HTML shell + root route
- Implement `renderDashboardPageHtml()`: login dialog, left menu (4 items), main panes, config editor wired to `/settings`, projects stub wired to `/board/repos`, Kanban → `/ui/board`.
- `app.get("/", …)` returns HTML.
- **Files:** `src/routes/dashboard-page.ts`, `src/index.ts`, `src/routes/dashboard.test.ts` (or ui test extension)
- **Check:** `GET /` 200 HTML contains login affordance, menu labels, `cursor-server-api-key`, and section ids; `/ui/board` still 200.

### Step 4 — Client auth gate & UX polish
- JS: probe `GET /settings` on login; toggle `.authed` class; gate menu/content; failed login message; collapse nav CSS.
- Config pane: load/save via authenticated fetch; show seed keys even before edit.
- **Files:** mostly `dashboard-page.ts`
- **Check:** route tests assert HTML contains probe/login markers; manual smoke optional (`npm run dev`). Anti-slop visual pass against AC7 checklist.

### Step 5 — Verification suite
- Ensure AC→tests in §5 all exist and pass under `node --test` / project test script + `npm run typecheck` + `npm run build`.
- **Files:** tests only as needed
- **Check:** AC8 satisfied; no Cursor cloud; `scan-secrets` clean.

## 4. Permissions, Tenancy & i18n

| Concern | Approach |
|---------|----------|
| Auth | Reuse `authMiddleware` / `resolveTenant`; master key → `tenantId: "master"`; tenant keys scoped as today. Settings are **global** (host-level), not per-tenant partitioned in v1 (document: shared homelab settings). |
| Tenancy leakage | Settings do not include tenant API keys or repo secrets. Projects stub lists board repos already gated by `/board` auth; no extra ACL in this slug. |
| RBAC | Binary: valid key vs not. No new roles. |
| i18n | `frontend.i18n.framework: none`. English UI strings only; no i18n key files. |

## 5. Test Coverage

Map every AC → concrete tests (node:test + assert, match existing route tests).

| AC | Test case / method | Location |
|----|--------------------|----------|
| AC1 | `GET / returns HTML shell with login` — status 200, `content-type` includes `text/html`, body includes login control / API key field / product title | `dashboard.test.ts` |
| AC2 | `settings rejects missing key when auth enabled` — 401; `settings accepts valid key` — 200 (login probe contract) | `settings.test.ts` |
| AC2 (UI contract) | HTML includes error/login messaging hooks (e.g. `#login-error` or equivalent) | `dashboard.test.ts` |
| AC3 | HTML includes left nav + main container markers (`nav`, `#main-pane` / `#pane`) and view switch hooks | `dashboard.test.ts` |
| AC4 | HTML includes labels Dashboard, Kanban, Projects, Configuration; Kanban references `/ui/board` | `dashboard.test.ts` |
| AC4 (regression) | `GET /ui/board` still 200 HTML (existing ui test remains green) | `ui.test.ts` |
| AC5 | HTML includes Projects stub/placeholder text referencing later projects management or link to `/ui/board`; no claim of full CRUD APIs added | `dashboard.test.ts` |
| AC6 | `board-db seeds default settings keys` — all five keys present after init | `board-db.test.ts` |
| AC6 | `PUT /settings updates value and GET reflects` | `settings.test.ts` |
| AC7 | HTML includes CSS variables / no reliance on purple keyword in critical chrome (spot-check: assert `--accent` or shared palette tokens present; assert absence of obvious slop class names if introduced) | `dashboard.test.ts` (lightweight) |
| AC8 | Suite runs with typecheck/build in verification; tests use short `"test-key"` stubs; no SDK imports in new tests | CI / local verify |

## 6. Invariants (Do Not Violate)

From `config.json.invariants` + this feature:

1. **localSdkRuntimeOnly** — no cloud Agent runtime.
2. **thinRoutesNoBusinessLogic** — persistence/validation in `board-db` (service).
3. **noHardcodedRepoAbsolutePaths** — use config/`REPOS_ROOT` patterns elsewhere; settings DB path from `BOARD_DB_PATH`.
4. **secretsFromEnvOnly** — do not persist `SERVER_API_KEY`, tenant keys, or `CURSOR_API_KEY` in `app_settings`.
5. **disposeAgentsAlways** — N/A (no agents created).
6. **settingSourcesEmptyUnlessIntentional** — N/A for SDK; do not confuse with app_settings table.
7. **commitPlanFilesOnlyAtStep8** — plan artifacts commit at ship, not mid-implement.
8. **Ops observation** — do not mark AC6 done without SQLite roundtrip evidence; do not mark AC5 done as full Projects CRUD.
9. **Deep links** — `/ui/board`, `/ui/prompt`, `/ui/spec-editor` remain public HTML routes.

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (thin routes, logic in services).
- [ ] Domain entities and mappings encapsulated (`app_settings` via `boardDb`).
- [ ] Schema migration added (sql.js `MIGRATIONS` + seed); no separate ORM project.
- [ ] Authorization checks applied on `/settings` (and stub uses existing `/board` auth).
- [ ] i18n keys declared — N/A (en-us only).
- [ ] Test cases cover all ACs (§5).
- [ ] Projects stub documented; no CRUD scope creep from `39`.
- [ ] Default config keys seeded and documented (§2 table).
- [ ] Deep links still pass existing `ui.test.ts`.
- [ ] `npm run typecheck` + `npm run build` + tests green; `scan-secrets` clean (short test keys).
- [ ] Anti-slop visual bar (AC7) checked against board palette.

## 8. Open Questions

| # | Question | Recommendation if unanswered at interview |
|---|----------|-------------------------------------------|
| Q1 | Kanban: full navigation to `/ui/board` vs iframe embed in main pane? | **Navigate** to `/ui/board` (simpler, preserves board chrome/auth field). |
| Q2 | Should settings be per-tenant later? | **Global v1** (single homelab host); defer tenancy partition. |
| Q3 | PUT replace-all vs merge patch? | **Merge** allowlisted keys only; omit keys unchanged. |
| Q4 | Expose `GET /settings/:key`? | **Not required**; list+put sufficient for AC6. |
| Q5 | Should Dashboard home show live task/job counts? | **Minimal summary** (static welcome + links); live metrics out of scope unless cheap reuse of existing public endpoints. |

No blockers for coding if Q1–Q3 follow recommendations.
