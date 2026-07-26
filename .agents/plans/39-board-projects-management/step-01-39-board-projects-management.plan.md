---
slug: 39-board-projects-management
title: "Kanban board projects management (CRUD, config, modals, list)"
status: "plan to be refined"
---

## 0. Summary & Business Rules

**Objective:** Operators manage board **projects** (create / list / edit / delete + config) from the root ops dashboard Projects pane via modal dialogs, without inventing a second persistence model.

**Business rule (explicit):** A **project is an alias UX** over the existing board **`repos`** row and `/board/repos` APIs from spec `32`. Same stable `id`, same fields (`name`, `remote_url`, `secret_ref`, `local_path`, timestamps). UI and docs say "Projects"; storage and API paths stay `repos`.

**Security:**
- Reuse existing board API-key auth (`authMiddleware` on `/board/*`).
- Persist `secret_ref` only; never return resolved secret material (keep `repoResponse` shape; assert in tests).
- Soft-block delete when any card references the repo (`409`), instead of silently cascading card loss.

**Out of scope:** Lane/execution (`34`), agent prompt widget (`35`), new harness runners, new SQLite parent `projects` table, clone-on-create / ensure-clone UX beyond existing repo APIs.

---

## 1. Definition of Ready & Scope

### Resolved assumptions

| # | Assumption | Resolution |
|---|------------|------------|
| A1 | Project vs repo | **Alias UX only.** No new parent entity. Cards remain `repo_id`-scoped. |
| A2 | API path | **Reuse `/board/repos`** (list/create/get/update/delete). Document that this **is** the projects API. Do **not** add `/board/projects` aliases (avoids `{repos}` vs `{projects}` drift; AC does not require a literal `/projects` path). |
| A3 | Display name | Existing unique `name` field is the display name (no extra `display_name` column). |
| A4 | List shape | Complete list via `GET /board/repos` → `{ repos: [...] }` (empty `[]` valid). No pagination required for AC2. |
| A5 | UI host | Primary CRUD in `GET /` Projects pane (`dashboard-page.ts`). Optional thin link from `/ui/board` → `/#projects` only; **no** duplicate CRUD modals on Kanban. |
| A6 | Delete policy | Soft-block when cards exist (`409` + clear error). Empty repo: delete OK (cleanup clone + remove row). Keep FK `ON DELETE CASCADE` as safety net for empty/orphan cases; route must check first. |
| A7 | Auth | Existing `SERVER_API_KEY` / tenant key via `X-API-Key` / Bearer (same as board). |

### Acceptance Criteria (measurable)

| AC | Criterion | Done when |
|----|-----------|-----------|
| AC1 | Authenticated project CRUD + 400/404/409 | Existing `/board/repos` CRUD retained; soft-block delete adds 409-when-cards; validation unchanged |
| AC2 | List suitable for UI | `GET /board/repos` returns id, name, remote_url, secret_ref, local_path, timestamps; empty OK |
| AC3 | Editable config; no secret leak | Modal edits name / remote_url / secret_ref (/ optional local_path); responses never include resolved token |
| AC4 | Projects list + create/open-edit | Dashboard Projects pane lists projects with Create + Edit actions |
| AC5 | Modal create/edit | Dialogs (not full-page); Cancel discards; Save POST/PUT then refresh list |
| AC6 | Delete confirm + soft-block | Confirm step; DELETE succeeds when no cards; 409 when cards reference repo |
| AC7 | Verify + tests | `npm run typecheck`, `npm run build`, `npm run scan-secrets`; route/UI tests for CRUD happy path + 401 + delete 409 |

### Out of scope (hard)

- Changing Start/Pause/Finish / lane rules (`34`)
- Prompt widget (`35`) / new runners
- New `projects` table or rename of `repos` / `repo_id`
- Full repo CRUD embedded in `/ui/board` Kanban chrome
- Real remote clone in CI

---

## 2. Technical Design & Architecture

### Evidence map (baseline @ `2d6e850` / current tree)

| Area | Status | Evidence |
|------|--------|----------|
| SQLite `repos` table | **Done** | `board-db.ts` ~99–107 (`name`, `remote_url`, `secret_ref`, `local_path`, timestamps) |
| Cards FK CASCADE | **Done (risk)** | `board-db.ts` ~110 `REFERENCES repos(id) ON DELETE CASCADE` |
| `listRepos` / CRUD service | **Done** | `board-db.ts` ~256–339 |
| HTTP `/board/repos` CRUD | **Done** | `board.ts` ~133–260 (GET/POST/GET:id/PUT/DELETE) |
| Auth on `/board` | **Done** | `index.ts` ~77–79; tests `board.test.ts` ~73–76 |
| `secret_ref` in responses (ref only) | **Done** | `board.ts` `repoResponse` ~87–97; test ~78–91 |
| Delete soft-block when cards | **Gap** | `board.ts` ~241–259 deletes unconditionally; no card count |
| Dashboard Projects list stub | **Partial** | `dashboard-page.ts` ~251–258 stub; `loadProjects` ~474–497 GET `/board/repos` read-only |
| Create/edit/delete modals | **Gap** | No project modal markup/JS in `dashboard-page.ts` |
| Board UI repo CRUD | **N/A (OOS)** | `ui.ts` loads repos for filter only (~755+) |
| Route tests for repo CRUD + 401 | **Partial** | `board.test.ts` auth + CRUD; **missing** delete-with-cards 409 |
| Dashboard UI markers | **Stub-era** | `dashboard.test.ts` ~76 asserts placeholder `39-board-projects-management` text |

### Project vs repo decision (canonical)

```text
UI label:  "Project"
API/DB:    board repos (/board/repos, table repos, cards.repo_id)
Meaning:   1:1 alias — operators manage clone/remote + secret_ref for a named workspace
```

**Rationale for no `/board/projects` aliases:** AC wording requires project CRUD capability, not a new path. Spec 32 + board/Kanban already call `/board/repos`. Aliases would duplicate handlers and force a second JSON envelope (`projects` vs `repos`) without AC gain. Prefer documenting alias in README/AGENTS/index.

### Layer edits

| Layer | Files | Change |
|-------|-------|--------|
| **Services** | `src/services/board-db.ts` | Add `countCardsByRepo(repoId): number` (or reuse `listCards({ repoId }).length` if kept thin) |
| **Routes** | `src/routes/board.ts` | Before `deleteRepo`: if card count > 0 → `409` `{ error: "..." }` |
| **Routes / UI** | `src/routes/dashboard-page.ts` | Replace stub with CRUD list + create/edit/delete modals; wire to `/board/repos` |
| **Tests** | `src/routes/board.test.ts` | Delete empty OK; delete with cards → 409; cards still present |
| **Tests** | `src/routes/dashboard.test.ts` | Assert modal markers / Create button; drop stub-string assertion |
| **Docs** | `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`, human + plan specs status | Status sync when feature ships (MEMORY: packaging/status doc sync) |

### Modal UX (dashboard)

Mirror existing patterns:
- Login gate already uses `role="dialog"` / `aria-modal` (`dashboard-page.ts` ~212).
- Kanban start modal CSS/JS in `ui.ts` is a style reference only; keep dashboard self-contained.

**Create modal fields:** `name`, `remote_url`, `secret_ref` (required); optional `local_path` only if already supported by CreateRepoSchema (optional/nullable today).

**Edit modal:** same fields prefilled from list/get; Save → `PUT /board/repos/:id`.

**Delete:** confirm dialog (or confirm section in edit modal) → `DELETE /board/repos/:id`; surface 409 message in UI without navigating away.

**Cancel:** close modal; discard form state (do not PUT/POST).

### Invariant checks (`config.json.invariants`)

| Invariant | How plan respects |
|-----------|-------------------|
| `thinRoutesNoBusinessLogic` | Card-count gate stays in route calling `boardDb`; no new service sprawl unless count helper is cleaner |
| `secretsFromEnvOnly` / no leak | Keep returning `secret_ref` name only; never resolve in list/get |
| `noHardcodedRepoAbsolutePaths` | Continue `resolveRepoLocalPath(REPOS_ROOT, …)` |
| `commitPlanFilesOnlyAtStep8` | Plan under `{plansDir}` not git-added this step |
| `localSdkRuntimeOnly` | Untouched |

### Fable domain

`fable.enabled` + `autoDetectDomain`: no new IaC/K8s/Docker/migration framework work. Soft-block is a small SQLite query in existing board DB. No `ws-fable-domain` binding required for this plan.

---

## 3. Step-by-Step Plan

### Step 1 — Soft-block delete (DB + API)

**Action:**
1. Add `countCardsByRepo(id: number): number` on `BoardDatabase` (SQL `COUNT(*)` or thin wrap of `listCards`).
2. In `DELETE /board/repos/:id`, after auth/404 checks: if count > 0 return `409` with message like `Cannot delete repository: N card(s) still reference it`.
3. Only then cleanup clone + `deleteRepo`.

**Files:** `src/services/board-db.ts`, `src/routes/board.ts`

**Checks:** Empty delete still 200 `{ ok: true }`; delete with cards 409 and row remains.

### Step 2 — Backend tests for delete policy + CRUD regression

**Action:**
1. Extend `board.test.ts`: create repo + card → DELETE → 409; list still has repo; delete card then DELETE → 200.
2. Keep existing CRUD + 401 + secret_ref non-leak assertions.
3. Use short stubs (`CURSOR_API_KEY: "test-key"`) per MEMORY scan-secrets trap.

**Files:** `src/routes/board.test.ts` (optional tiny `board-db.test.ts` count helper)

**Checks:** `node --test` (or project test invocation used for board routes) green for new cases.

### Step 3 — Dashboard Projects CRUD UI (modals)

**Action:**
1. Remove placeholder-note / "lands in 39" copy.
2. Add toolbar: **New project** button.
3. List rows: name, remote summary, actions **Edit** / **Delete**.
4. Add create/edit modal markup + CSS consistent with dashboard tokens (`--accent`, no purple-gradient).
5. Wire JS: POST create, PUT update, DELETE with `window.confirm` or dedicated confirm dialog; on success `loadProjects()`; on 409 show error text.
6. Cancel closes and resets form fields.
7. Keep calling `/board/repos` (response key `repos`); label UI "Projects".

**Files:** `src/routes/dashboard-page.ts`

**Checks:** HTML contains create/edit modal ids + `/board/repos` fetch paths; no full-page form routes.

### Step 4 — Dashboard / UI tests

**Action:**
1. Update `dashboard.test.ts`: assert Projects pane has create/edit affordances (e.g. `btn-project-new`, `project-modal`, absence of stub slug string).
2. Optionally assert `/ui/board` still 200 (regression).
3. Do **not** require browser MCP for AC7; static HTML + API route tests suffice for CI.

**Files:** `src/routes/dashboard.test.ts`

### Step 5 — Optional board entry affordance (thin)

**Action:** Add a small link on `/ui/board` header/toolbar: "Manage projects" → `/#projects` (dashboard). No CRUD duplication.

**Files:** `src/routes/ui.ts` (minimal), `src/routes/ui.test.ts` if assertion needed

**Skip if** Step 3 alone satisfies AC4 ("dedicated projects panel" via dashboard nav). Prefer include for discoverability; keep ≤ few lines.

### Step 6 — Docs / status sync (same ship turn)

**Action:** When implementation lands (Step 4/8 delivery), update:
- `README.md` Ops UI row / `GET /` Projects stub note
- `AGENTS.md` Planned areas (mark 39 shipped)
- `.agents/specs/index.PRD` Next → Done for 39
- Spec frontmatter `status` on human + plan mirrors

**Files:** docs listed above (not in early implement commits if process splits; ensure before PR)

**Checks:** No contradiction "stub until 39" left behind (MEMORY status-doc trap).

### Step 7 — Verification gate

Run:
- `npm run typecheck`
- `npm run build`
- `npm run scan-secrets`
- Board + dashboard tests already covered under typecheck/build unless project also runs `node --test` in CI — run board/dashboard test files if that is local practice.

---

## 4. Permissions, Tenancy & i18n

| Concern | Approach |
|---------|----------|
| Auth | Existing `authMiddleware` on `/board/*`; UI sends `X-API-Key` from sessionStorage (already in dashboard) |
| Tenancy | Keep `checkRepoTenantAccess` on create/get/update/delete/list filter (unchanged) |
| i18n | None (`frontend.i18n.framework: none`); English UI strings only |
| RBAC | No new roles; API key = operator |

---

## 5. Test Coverage

| AC | Test case | Location / method |
|----|-----------|-------------------|
| AC1 | Unauth GET `/board/repos` → 401 | `board.test.ts` `"requires authentication"` (existing) |
| AC1 | POST/GET/PUT happy path | `board.test.ts` `"CRUD repos without exposing secrets"` (existing) |
| AC1/AC6 | DELETE with cards → 409; without → 200 | **New** e.g. `"soft-blocks delete when cards reference repo"` |
| AC2 | List returns fields; empty OK | Existing list assert; add empty-list if missing |
| AC3 | Response `secret_ref` equals env name; body lacks token value | Existing CRUD test; keep |
| AC3 | Invalid body → 400 | Rely on Zod path (add minimal invalid POST if not present) |
| AC4/AC5 | Dashboard HTML has Projects pane + modal create/edit markers | `dashboard.test.ts` (update) |
| AC6 | Confirm affordance present in HTML (delete button / confirm copy) | `dashboard.test.ts` |
| AC7 | typecheck / build / scan-secrets | Shell verification |
| AC7 | No real remotes | Tests use fake URLs + env `secret_ref` only |

---

## 6. Invariants (Do Not Violate)

1. **Local SDK only** — no cloud runtime changes.
2. **Thin routes** — HTTP validation + `boardDb` calls; no clone/exec logic in dashboard HTML beyond fetch.
3. **No hardcoded absolute repo paths** — always via `REPOS_ROOT` helpers.
4. **Secrets from env/files via `secret_ref` only** — never store or echo resolved tokens.
5. **Dispose agents** — N/A for this feature (no new agent runs).
6. **`settingSources: []`** — N/A.
7. **Plan files** — do not commit under `{plansDir}` until Step 8.
8. **No scope creep** — do not touch execution lanes, prompt widget, or runners.
9. **No new parent entity** — project ≡ repo alias.

---

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (routes thin; UI in `dashboard-page.ts`; DB count helper in `board-db.ts`).
- [ ] No new domain entity / no `projects` table.
- [ ] Soft-block delete before CASCADE path.
- [ ] Authorization unchanged on `/board/*`.
- [ ] i18n N/A (English only).
- [ ] Tests cover AC1–AC7 (API + HTML markers + verify commands).
- [ ] Dashboard stub text / `39-board-projects-management` placeholder removed; tests updated.
- [ ] Docs status sync (README / AGENTS / index.PRD) on ship.
- [ ] `scan-secrets` clean; test keys short (`test-key` / `fake-board-key`).

---

## 8. Open Questions

All planning questions resolved for implement:

| Topic | Decision |
|-------|----------|
| Project vs repo | Alias UX over `repos` / `/board/repos` |
| `/board/projects` aliases | **Not** added; document `/board/repos` as projects API |
| UI host | Dashboard Projects pane + modals; optional board link |
| Display name | Existing `name` |
| Delete | Soft-block 409 when cards exist |
| Pagination | Complete list only |

*(Complexity remains **complex** for orch: API soft-block + dashboard modal UX + tests + doc sync. Step 2 interview may still refine wording/task split; no blocker for coding.)*

---

## Appendix — File touch list (expected)

| Path | Role |
|------|------|
| `src/services/board-db.ts` | Card count helper |
| `src/routes/board.ts` | Delete soft-block |
| `src/routes/board.test.ts` | 409 delete tests |
| `src/routes/dashboard-page.ts` | Projects CRUD modals |
| `src/routes/dashboard.test.ts` | UI marker assertions |
| `src/routes/ui.ts` | Optional manage-projects link |
| `src/routes/ui.test.ts` | Optional link assert |
| `README.md` / `AGENTS.md` / `.agents/specs/index.PRD` | Status sync at ship |
| `.agents/specs/39-board-projects-management.spec.md` | Status frontmatter at ship |

**Do not invent:** new migration framework, new ORM, React SPA, `/board/projects` router, parent `projects` table.
