---
slug: 40-main-page-dashboard
title: "Main page dashboard shell (root UI, login, left menu, SaaS layout)"
status: "plan refined ok"
complexity: complex
shared_understanding: confirmed
autoMode: true
refine_round: 0
orch_note: "complex — UI shell + client auth gate + SQLite settings + protected APIs; exceeds dagThresholds. Prefer ws-spec-to-pr full path, not lite."
---

## 0. Summary & Business Rules

**Objective:** Make `GET /` the primary operator entry for cursor-server. Unauthenticated browsers see a login dialog (API key / tenant key). Authenticated operators get a lightweight SaaS shell: left nav + center pane that swaps by menu selection (Dashboard, Kanban, Projects stub, Configuration).

**Business rules:**
1. Root shell is public HTML (same pattern as `/ui/*`); protected data/APIs stay behind existing `authMiddleware` (`SERVER_API_KEY` / `TENANTS` via `X-API-Key`, Bearer, or query).
2. Client stores the key in `sessionStorage` under `cursor-server-api-key` (reuse board / prompt / spec-editor convention). No new secret storage in DB or files.
3. Config values persist server-side in SQLite (`BOARD_DB_PATH`, default `./data/board.db`) so operators share settings on the homelab host; not localStorage-only.
4. Deep links `/ui/board`, `/ui/prompt`, `/ui/spec-editor` must keep working unchanged.
5. **Projects decision (AC5):** **Stub only.** Do **not** implement create/edit/delete CRUD here. Show a read-only list of existing board repos via `GET /board/repos` when authenticated, plus a clear placeholder that full project management ships with `39-board-projects-management`, and a link to `/ui/board`. Scope stops at stub UX.

**Security mitigations:**
- Login probe must hit a protected endpoint (`GET /settings`); failed auth returns generic non-leaky error (reuse middleware `"Invalid API key"` / `"Missing authentication credentials"`; UI shows a single user-facing message: “Invalid or missing API key”).
- Settings APIs require `authMiddleware`; never accept or persist API keys / env secrets as setting values (allowlist-only keys).
- Config keys are allowlisted (zod); reject unknown keys and oversized values (`max(256)`).
- MEMORY: test stubs for API keys must stay short (`"test-key"` / `"fake-board-key"`) so `scan-secrets` does not false-positive.

**Design bar:** Calm dark ops UI aligned with existing board CSS variables (`--bg`, `--panel`, `--accent` blue `#3d8bfd`, not purple). No glow stacks, pill clutter, marketing hero, or card-everywhere layout. Collapsible left nav on narrow viewports (`max-width: 720px`).

## 1. Definition of Ready & Scope

### Resolved assumptions
| # | Assumption | Evidence / default |
|---|------------|-------------------|
| A1 | Serve shell at app root `GET /` (not only under `/ui`). | `healthRoutes` only mounts `/health`; `GET /` is free (`src/index.ts`, `src/routes/health.ts`). |
| A2 | HTML/CSS/JS follows existing inline/`c.html` patterns — extract `dashboard-page.ts` like `prompt-widget.ts` / `spec-editor-page.ts`. No new SPA framework. | `src/routes/ui.ts` + extracted page modules. |
| A3 | Settings live in the same sql.js board DB (`boardDb` / `BOARD_DB_PATH`); add `app_settings` via appended `MIGRATIONS` entry. | `src/services/board-db.ts` `MIGRATIONS` + `init` → `runMigrations` → `persist`. |
| A4 | Projects CRUD deferred to `39`; this plan ships stub list + placeholder + link only. | Hard decision; spec 39 owns CRUD. |
| A5 | Auth gate is client-side reveal of shell chrome after successful probe; HTML document itself remains publicly fetchable. | Same as `/ui/board`. |
| A6 | When `SERVER_API_KEY` unset and `TENANTS` empty, middleware allows anonymous; login/probe with empty key succeeds (local-dev). | `authMiddleware` early-return `tenantId: "anonymous"`. |
| A7 | **Kanban = navigate to `/ui/board`** (full page). No iframe. | Hard decision + evidence: board is a full document with its own header/API-key field; iframe would double-chrome and nest scroll. |
| A8 | On page load, if `sessionStorage` already has a key (or auth disabled), auto-probe `GET /settings` and reveal shell without re-typing. | Continuity with board/prompt KEY_STORAGE reuse. |
| A9 | Settings are **global host-level** (not per-tenant partitioned) in v1. | Single `BOARD_DB_PATH`; no tenant column on board tables. |
| A10 | `PUT /settings` is **merge patch** of allowlisted keys; omit keys leave existing values. | Assumed-default (was Q3). |
| A11 | No `GET /settings/:key`; list + put sufficient. | Assumed-default (was Q4). |
| A12 | Dashboard home is **minimal** (welcome + links to `/ui/board`, `/ui/prompt`, `/ui/spec-editor`); no live task/job metrics. | Assumed-default (was Q5); metrics need auth + extra APIs. |

### Acceptance Criteria (measurable)
| AC | Measurable outcome |
|----|--------------------|
| AC1 | `GET /` → `200` `text/html` with login UI; accepts same credential shapes as API. |
| AC2 | Valid key (or anonymous mode) reveals dashboard chrome; invalid key shows error and keeps protected panes gated; stored key auto-probes on reload. |
| AC3 | Left menu + main container; menu selection updates main pane without losing chrome (hash soft-nav for in-shell panes). |
| AC4 | Menu: Dashboard, Kanban board, Projects, Configuration; **Kanban navigates to `/ui/board`**. |
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
- Iframe embed of Kanban.
- Per-tenant settings partition.
- Live ops metrics / SSE on Dashboard home.
- Wiring `board_default_lane` / `default_agent` into board or task APIs in this slug (preference store only).

### Complexity (orch)
**complex** — multi-layer (routes + services/SQLite + public HTML shell + auth probe + tests). Expect ~8–12 files touched; sequential DAG skip thresholds exceeded. Use full `ws-spec-to-pr`, not lite.

## 2. Technical Design & Architecture

### Stack layers (from config.json)
| Layer | Path | Change |
|-------|------|--------|
| entry | `src/index.ts` | Mount `GET /` dashboard HTML; mount protected `/settings` routes with `authMiddleware`. |
| config | `src/config.ts` | No new secrets. Reuse `BOARD_DB_PATH`. (No new env keys required.) |
| routes | `src/routes/` | New dashboard page module + settings API route + tests. |
| services | `src/services/board-db.ts` | Migration + get/set/list settings + seed defaults. Keep methods on `BoardDatabase` (no separate `app-settings.ts` unless file bloat forces it — default: keep on class). |
| jobs | — | No change. |

**Frontend:** none in config; UI is server-rendered HTML + vanilla JS (existing pattern).

### Fable / Ops domain (light)
`fable.enabled` + `autoDetectDomain`: this feature is **Ops** (homelab operator console), with SQLite persistence signal.

| Binding primary sources | Observation |
|-------------------------|-------------|
| `src/middleware/auth.ts`, `src/routes/ui.ts` (KEY_STORAGE), `src/services/board-db.ts` migrations, `BOARD_DB_PATH` | `npm run typecheck` / `build` / `npm test`; `GET /` HTML; settings GET after seed; 401 without key when auth enabled |
| Do not invent secret columns or localStorage-only “done” for AC6 | |

Ops frauds to avoid: claiming Projects CRUD done via stub; claiming persistence via sessionStorage only; embedding real API keys in tests.

### Auth approach (locked)
1. **Public:** `GET /` returns HTML shell always.
2. **Client:** Login field; on success (and on change) `sessionStorage.setItem("cursor-server-api-key", key)`.
3. **Probe:** Login submit and page-load restore both `fetch("GET /settings", { headers: { "X-API-Key": key, "Authorization": "Bearer " + key } })` (mirror board `authHeaders`). `200` → show shell; `401` → non-leaky error, stay gated.
4. **Anonymous mode:** Probe returns `200` without key when auth disabled → enter dashboard.
5. **Logout:** Clear `sessionStorage` key + remove `.authed` / show login again.
6. **No** cookie session server; reuse existing key header model.

### Kanban approach (locked — navigate)
**Decision:** Primary menu action for “Kanban board” sets `window.location.href = "/ui/board"` (or `<a href="/ui/board">`).

**Why not iframe (evidence):**
- `/ui/board` is a full HTML document with its own header, API-key input, toast, and status bar (`src/routes/ui.ts`).
- Embedding it inside the shell would produce double chrome, duplicate key fields, and nested scrolling.
- Deep link already works and must remain unchanged (AC notes); navigation preserves that UX without new CSP/`X-Frame-Options` concerns.
- Hash `#kanban` (if used) should immediately redirect to `/ui/board` rather than rendering an in-pane stub.

### SQLite storage
**Location:** `config.BOARD_DB_PATH` (default `./data/board.db`).

**Migration** — append to `MIGRATIONS` in `board-db.ts`. Note: `schema_version` is insert-once (`version=1`) and is **not** used to select migrations; do **not** invent version-bump machinery. `CREATE TABLE IF NOT EXISTS` is sufficient.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Seed defaults** (insert-if-missing on `init` after migrations; e.g. `INSERT OR IGNORE` or select-then-insert; then `persist()`):

| Key | Default | Validation on PUT |
|-----|---------|-------------------|
| `default_agent` | `default` | Must be in `AGENTS` (`src/agents.ts`: default, planner, implementer, plan+implementer, spec-to-pr, spec-to-pr-lite). |
| `default_harness_runner` | `cursor-local` | Must be known runner id: `cursor-local`, `cursor-sdk`, `hermes`, `opencode` (static allowlist matching registry; optional: `runnerRegistry.list()` after side-effect imports). |
| `ui_theme` | `dark` | `dark` \| `light`. |
| `ui_density` | `comfortable` | `comfortable` \| `compact`. |
| `board_default_lane` | `backlog` | Must be in `BOARD_LANES` (`src/services/board-db.ts`). |

**Consumer note:** v1 only persists preferences. Board/task routes need **not** read these keys yet. Shell applies `ui_theme` / `ui_density` via `data-theme` / `data-density` on `<html>` or shell root when settings load.

Allowlist only these five keys in zod on PUT; reject unknown keys with `400`. Values are plain strings (no secrets). Max length **256** (aligned with board card `title` max).

### API surface
| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `GET` | `/` | public | Dashboard HTML shell. |
| `GET` | `/settings` | protected | `{ settings: Record<string,string> }` (all keys, after seed). |
| `PUT` | `/settings` | protected | Body `{ settings: { key: value, ... } }` merge-update allowlisted keys with per-key enum checks; return updated full map. |
| (reuse) | `GET /board/repos` | protected | Projects stub list (existing). |

Thin routes → service methods on `boardDb`.

**Wire pattern (match `src/index.ts`):**
```ts
app.get("/", (c) => c.html(renderDashboardPageHtml()));
app.use("/settings", authMiddleware(config));
app.use("/settings/*", authMiddleware(config));
app.route("/settings", createSettingsRoutes(config));
```
Mount `GET /` alongside public UI; keep `app.route("/", healthRoutes)` so `/health` unchanged.

### HTML / CSS approach
- New module `src/routes/dashboard-page.ts`: `renderDashboardPageHtml()` returning full document string.
- Layout: `aside.nav` + `main#main-pane`; hash soft navigation for in-shell views: `#dashboard`, `#projects`, `#config`.
- Kanban: navigate to `/ui/board` (see above).
- CSS: copy board `:root` tokens from `ui.ts` (`--bg #0f1419`, `--panel #1a2332`, `--border #2d3a4d`, `--text #e7ecf3`, `--muted #8b9bb4`, `--accent #3d8bfd`, `--ok`, `--bad`, `--warn`, `--sans` / `--mono`). Optional `[data-theme="light"]` variable swap for AC6 theme seed (restrained; not purple).
- `@media (max-width: 720px)`: collapse nav to top drawer / hamburger; one composition.
- Anti-slop: no purple gradient theme, no box-shadow glow stacks, no chip rows, no marketing hero.

### Client UX details (refined)
| Concern | Behavior |
|---------|----------|
| Login | Modal/overlay or centered gate covering chrome until `.authed`. |
| Auto-restore | On DOMContentLoaded: read KEY_STORAGE → probe → reveal or stay gated. |
| Logout | Button in shell chrome; clears storage + gates. |
| Error | `#login-error` (or equivalent) single message; do not echo server error strings that might leak. |
| Config pane | Load via `GET /settings`; edit inputs; Save → `PUT /settings`; show all five seed keys. |
| Projects pane | `GET /board/repos` → render **name** list (read-only). May show `remote_url` as muted secondary text. Do **not** highlight `secret_ref` as a secret value (it is an env ref name, but keep UI minimal: name-first). Empty state OK. Placeholder: “Full create / edit / delete lands in 39-board-projects-management.” Link: “Open Kanban board” → `/ui/board`. No add/edit/delete buttons (or disabled `title="Coming in spec 39"`). |
| Dashboard pane | Title + short copy + links to board / prompt / spec-editor. |

### Projects stub (AC5) — explicit
```
Projects pane:
  - Heading: Projects
  - Body: fetch GET /board/repos → render name list (read-only)
  - Note: "Full create / edit / delete lands in 39-board-projects-management."
  - Link: "Open Kanban board" → /ui/board
  - Omit add/edit/delete (or disabled + title="Coming in spec 39")
```
Do not invent a parallel projects table in this slug.

### Exact files to create / modify

| Action | File |
|--------|------|
| **Create** | `src/routes/dashboard-page.ts` — HTML/CSS/JS shell (login, nav, panes, config editor client). |
| **Create** | `src/routes/settings.ts` — `createSettingsRoutes()` GET/PUT. |
| **Create** | `src/routes/settings.test.ts` — auth + seed + update + reject unknown key. |
| **Create** | `src/routes/dashboard.test.ts` — `GET /` HTML assertions (mount like production: root route + optionally `/ui` regression). |
| **Modify** | `src/services/board-db.ts` — `app_settings` migration, seed, `listSettings` / `setSettings` (and optional `getSetting`). |
| **Modify** | `src/services/board-db.test.ts` — seed + persist roundtrip (use isolated temp DB path; note singleton `boardDb` — follow existing test init/close pattern). |
| **Modify** | `src/index.ts` — `GET /` + `authMiddleware` + `/settings` route. |
| **Do not** | Create `app-settings.ts` by default. |
| **Docs** | Prefer later `ws-sync-spec` / ship; implement may leave README alone unless Step 4 needs a one-line entry for `GET /`. |

**Do not modify:** board execution, lane logic, Hermes/OpenCode runners, auth middleware semantics (only reuse), `/ui/board` HTML behavior.

### Invariant checks
- `thinRoutesNoBusinessLogic`: settings validation/persistence in service (+ thin zod at route boundary is OK, matching `board.ts`).
- `secretsFromEnvOnly`: settings values never store API keys; secrets remain env / `secret_ref`.
- `noHardcodedRepoAbsolutePaths`: use `BOARD_DB_PATH` from config.
- `localSdkRuntimeOnly`: no SDK calls in this feature.
- `commitPlanFilesOnlyAtStep8`: plan artifacts commit at delivery.

### Scenario probes (resolved)
| Probe | Resolution |
|-------|------------|
| Soft-deletion | N/A — no delete API; keys always present via seed. |
| Concurrency | Last-write-wins; single-process sql.js + `persist()` after write. No optimistic locking. |
| List sizing | Fixed five keys; no pagination. Projects stub uses existing full `GET /board/repos` list (no new paging). |
| Rate limits | None in codebase; do not add for this feature. |

## 3. Step-by-Step Plan

Ordered by dependency. Each step: action → files → check.

### Step 1 — Domain & Database
- Add `app_settings` migration + seed-if-missing for the five default keys.
- Add `listSettings(): Record<string,string>`, `setSettings(partial: Record<string,string>): Record<string,string>` (persist after write). Optional: reject unknown keys at service layer too.
- **Files:** `src/services/board-db.ts`, `src/services/board-db.test.ts`
- **Check:** unit test: init empty DB → defaults present; set `ui_theme=light` → reopen/list still `light`.

### Step 2 — Application / Settings API
- `createSettingsRoutes(config)` with zod body schema (allowlist keys, string values, max 256, per-key enums).
- Wire `app.use("/settings", authMiddleware(config))` + `app.use("/settings/*", …)` + `app.route("/settings", …)`.
- **Files:** `src/routes/settings.ts`, `src/routes/settings.test.ts`, `src/index.ts`
- **Check:** with test config key → `GET /settings` 200 includes defaults; without key when auth on → 401; `PUT` updates and `GET` reflects; unknown key → 400; invalid enum → 400. Use `SERVER_API_KEY: "test-key"` or `"fake-board-key"` (MEMORY / board.test pattern).

### Step 3 — Dashboard HTML shell + root route
- Implement `renderDashboardPageHtml()`: login gate, left menu (4 items), main panes, config editor → `/settings`, projects stub → `/board/repos`, Kanban → `/ui/board`.
- `app.get("/", …)` returns HTML.
- **Files:** `src/routes/dashboard-page.ts`, `src/index.ts`, `src/routes/dashboard.test.ts`
- **Check:** `GET /` 200 HTML contains login affordance, menu labels, `cursor-server-api-key`, pane/nav markers; `/ui/board` still 200.

### Step 4 — Client auth gate & UX polish
- JS: probe on login + on load; toggle `.authed`; gate menu/content; logout; failed login message; collapse nav CSS; apply theme/density attrs from settings.
- **Files:** mostly `dashboard-page.ts`
- **Check:** HTML contains probe/login/logout markers; anti-slop visual pass against AC7.

### Step 5 — Verification suite
- Ensure AC→tests in §5 all exist and pass under `npm test` (`npm run build && node --test dist/**/*.test.js`) + `npm run typecheck` (+ `scan-secrets` before commit).
- **Note:** `config.json` `verification.backendTest` is only `typecheck`; implementers still run **`npm test`** for AC8 route coverage.
- **Check:** AC8 satisfied; no Cursor cloud; short test keys.

## 4. Permissions, Tenancy & i18n

| Concern | Approach |
|---------|----------|
| Auth | Reuse `authMiddleware` / `resolveTenant`; master key → `tenantId: "master"`; tenant keys scoped as today. Settings are **global** (host-level), not per-tenant partitioned in v1. |
| Tenancy leakage | Settings do not include tenant API keys or repo secrets. Projects stub lists board repos already gated by `/board` auth + existing `checkRepoTenantAccess` filter. |
| RBAC | Binary: valid key vs not. No new roles. |
| i18n | `frontend.i18n.framework: none`. English UI strings only. |

## 5. Test Coverage

Map every AC → concrete tests (node:test + assert).

| AC | Test case / method | Location |
|----|--------------------|----------|
| AC1 | `GET / returns HTML shell with login` — 200, `text/html`, login control / API key field / product title | `dashboard.test.ts` |
| AC2 | `settings rejects missing key when auth enabled` — 401; `settings accepts valid key` — 200 | `settings.test.ts` |
| AC2 (UI) | HTML includes `#login-error` (or equivalent) and KEY_STORAGE / probe markers | `dashboard.test.ts` |
| AC3 | HTML includes left nav + `#main-pane` (or `#pane`) and hash/view hooks | `dashboard.test.ts` |
| AC4 | Labels Dashboard, Kanban, Projects, Configuration; Kanban references `/ui/board` (href or location) | `dashboard.test.ts` |
| AC4 (regression) | `GET /ui/board` still 200 | `ui.test.ts` (existing) |
| AC5 | Projects stub/placeholder text (39 or “coming”); no CRUD claim | `dashboard.test.ts` |
| AC6 | `board-db seeds default settings keys` — all five after init | `board-db.test.ts` |
| AC6 | `PUT /settings updates value and GET reflects`; reject unknown key | `settings.test.ts` |
| AC7 | HTML includes `--accent` (or shared palette tokens); no purple-gradient class names | `dashboard.test.ts` (lightweight) |
| AC8 | Suite via `npm test` + typecheck; short `"test-key"` stubs; no SDK imports in new tests | local verify |

## 6. Invariants (Do Not Violate)

1. **localSdkRuntimeOnly** — no cloud Agent runtime.
2. **thinRoutesNoBusinessLogic** — persistence in `board-db`; zod at route OK.
3. **noHardcodedRepoAbsolutePaths** — settings DB path from `BOARD_DB_PATH`.
4. **secretsFromEnvOnly** — do not persist `SERVER_API_KEY`, tenant keys, or `CURSOR_API_KEY` in `app_settings`.
5. **disposeAgentsAlways** — N/A.
6. **settingSourcesEmptyUnlessIntentional** — N/A for SDK; do not confuse with `app_settings` table.
7. **commitPlanFilesOnlyAtStep8** — plan artifacts commit at ship.
8. **Ops observation** — AC6 needs SQLite roundtrip; AC5 is stub not CRUD.
9. **Deep links** — `/ui/board`, `/ui/prompt`, `/ui/spec-editor` remain public HTML routes.

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (thin routes, logic in services).
- [ ] `app_settings` via `boardDb`; migration appended; seed-if-missing.
- [ ] Authorization on `/settings` (and stub uses existing `/board` auth).
- [ ] i18n — N/A (en-us only).
- [ ] Tests cover all ACs (§5); `npm test` + typecheck green.
- [ ] Projects stub only; no CRUD scope creep from `39`.
- [ ] Kanban navigates to `/ui/board` (no iframe).
- [ ] Default config keys seeded and documented (§2 table).
- [ ] Deep links still pass `ui.test.ts`.
- [ ] `scan-secrets` clean (short test keys).
- [ ] Anti-slop visual bar (AC7) vs board palette.

## 8. Open Questions

| # | Question | Status | Resolution |
|---|----------|--------|------------|
| Q1 | Kanban: navigate vs iframe? | **assumed-default** | **Navigate** to `/ui/board`. Evidence: full-page board chrome; hard decision. |
| Q2 | Settings per-tenant later? | **assumed-default** | **Global v1**; defer partition. |
| Q3 | PUT replace-all vs merge? | **assumed-default** | **Merge** allowlisted keys only. |
| Q4 | Expose `GET /settings/:key`? | **assumed-default** | **Not required**. |
| Q5 | Live task/job counts on Dashboard? | **assumed-default** | **Minimal** welcome + deep links only. |
| Q6 | Auto-probe sessionStorage on load? | **assumed-default** | **Yes** — restore shell without re-login when key valid. |
| Q7 | Apply light theme CSS now? | **assumed-default** | Persist `ui_theme`; apply via `data-theme` with restrained light variable swap (or dark-only render if light incomplete — prefer minimal light swap). |
| Q8 | Consume settings in board/tasks APIs? | **assumed-default** | **No** in this slug — preference store only. |

No blocking gaps remain. `shared_understanding: confirmed` (autoMode).

## Interview registry

| id | class | section | gap | recommendation | status | resolution | dependsOn |
|----|-------|---------|-----|----------------|--------|------------|-----------|
| G01 | blocking | 0 / AC4 | Kanban navigate vs iframe undecided in draft Open Questions | Navigate to `/ui/board` | resolved | Hard decision + codebase: board is full document with own API-key chrome (`ui.ts`); iframe = double chrome. Locked: navigate only. | — |
| G02 | blocking | 0 / AC5 | Projects CRUD vs stub | Stub only; defer to 39 | resolved | Hard decision; confirmed against spec 39 ownership of CRUD/modals. | — |
| G03 | blocking | 2 | Settings storage / secret risk | SQLite `app_settings` in `BOARD_DB_PATH`; allowlist; no secret keys | resolved | Hard decision; `boardDb` migrations + persist pattern confirmed. | — |
| G04 | blocking | 2 | Auth gate model | Public HTML + sessionStorage + probe `/settings` | resolved | Hard decision; matches `authMiddleware` + KEY_STORAGE convention. | — |
| G05 | blocking | 2 / Q3 | PUT merge vs replace-all | Merge patch | resolved | assumed-default: merge allowlisted keys; omit = unchanged. | — |
| G06 | blocking | 2 | Will `GET /` collide with health? | Mount HTML at `/`; keep `/health` | resolved | `healthRoutes` only defines `/health`; root free. | — |
| G07 | blocking | 2 / AC2 | Session restore on reload unspecified | Auto-probe stored key on load | resolved | assumed-default: yes (A8). | G04 |
| G08 | non-blocking | 2 / Q2 | Per-tenant settings | Global v1 | resolved | assumed-default: global host settings; document deferral. | — |
| G09 | non-blocking | 2 / Q4 | Per-key GET | Omit | resolved | assumed-default: list+put only. | — |
| G10 | non-blocking | 2 / Q5 | Dashboard live metrics | Minimal welcome | resolved | assumed-default: static + deep links; no new metrics APIs. | — |
| G11 | non-blocking | 2 | Soft-delete settings | N/A | resolved | No delete API; seed keeps keys present. | — |
| G12 | non-blocking | 2 | Concurrent PUTs | Last-write-wins | resolved | Single-process sql.js; no locking. | — |
| G13 | non-blocking | 2 | List/pagination | Fixed 5 keys | resolved | No pagination. Projects reuse existing repos list. | — |
| G14 | non-blocking | 2 | Rate limits | None | resolved | Do not invent rate limits. | — |
| G15 | non-blocking | 2 | schema_version bump | Append CREATE IF NOT EXISTS only | resolved | Version row unused for migration selection today. | — |
| G16 | non-blocking | 2 | Enum validation depth | Validate agent/runner/theme/density/lane on PUT | resolved | assumed-default: zod enums + AGENTS / BOARD_LANES / known runners. | G05 |
| G17 | non-blocking | 2 | Value max length | 256 | resolved | Align with board title max. | — |
| G18 | non-blocking | 2 | Separate `app-settings.ts` | Keep on `BoardDatabase` | resolved | assumed-default: no new file unless bloat. | — |
| G19 | non-blocking | 2 | Settings consumers in board UI | Preference store only | resolved | assumed-default: do not wire board/tasks in this slug. | — |
| G20 | non-blocking | 5 | Verify command vs config.backendTest | Run `npm test` + typecheck | resolved | package.json `test` builds and runs route tests; config key is typecheck-only — document both. | — |
| G21 | non-blocking | 3 | Logout control | Include logout | resolved | assumed-default: clear KEY_STORAGE + re-gate. | G07 |
| G22 | non-blocking | 2 | Projects list fields | Name-first read-only list | resolved | Use `GET /board/repos`; avoid promoting `secret_ref` in stub UI. | G02 |

**gap_registry_summary:** `blocking_resolved: 7`, `assumed_defaults: 15`, `blocking_open: 0`
