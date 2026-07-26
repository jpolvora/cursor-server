---
slug: 39-board-projects-management
title: "Kanban board projects management (CRUD, config, modals, list)"
status: "plan refined ok"
complexity: complex
shared_understanding: confirmed
autoMode: true
refine_round: 0
orch_note: "complex — soft-block delete API + dashboard modal CRUD UX + tests + doc sync; exceeds dagThresholds. Prefer ws-spec-to-pr full path, not lite."
---

## 0. Summary & Business Rules

**Objective:** Operators manage board **projects** (create / list / edit / delete + config) from the root ops dashboard Projects pane via modal dialogs, without inventing a second persistence model.

**Business rule (locked):** A **project is an alias UX** over the existing board **`repos`** row and `/board/repos` APIs from spec `32`. Same stable `id`, same fields (`name`, `remote_url`, `secret_ref`, `local_path`, timestamps). UI and docs say "Projects"; storage and API paths stay `repos`.

**Security:**
- Reuse existing board API-key auth (`authMiddleware` on `/board/*`).
- Persist `secret_ref` only; never return resolved secret material (keep `repoResponse` shape; assert in tests).
- Soft-block delete when any card references the repo (`409`), instead of silently cascading card loss.
- **Ordering invariant:** card-count check runs **before** `cleanupClone` so a blocked delete never wipes a working tree.

**Out of scope:** Lane/execution (`34`), agent prompt widget (`35`), new harness runners, new SQLite parent `projects` table, `/board/projects` path aliases, ensure-clone / cleanup-clone buttons in the Projects pane, `local_path` fields in modals (API-only), soft-delete / `deleted_at` column.

---

## 1. Definition of Ready & Scope

### Locked decisions (Step 1 — do not reopen)

| # | Decision |
|---|----------|
| L1 | Project = alias UX over `repos` / `/board/repos` |
| L2 | No `/board/projects` aliases |
| L3 | Dashboard Projects pane modals for CRUD |
| L4 | Soft-block delete `409` when cards exist |
| L5 | Display name = `repos.name` (unique) |

### Resolved assumptions (Step 2 / `[AUTO]`)

| # | Assumption | Resolution |
|---|------------|------------|
| A1 | Project vs repo | Alias UX only. Cards remain `repo_id`-scoped. |
| A2 | API path | Reuse `/board/repos`. Document as projects API. |
| A3 | Display name | Existing unique `name` field. |
| A4 | List shape | Complete list `{ repos: [...] }`; empty `[]` valid. No pagination. |
| A5 | UI host | Primary CRUD in `GET /` Projects pane (`dashboard-page.ts`). |
| A6 | Delete policy | Soft-block when cards exist (`409` + clear error). Empty repo: cleanup clone + delete row. Keep FK `ON DELETE CASCADE` as safety net. |
| A7 | Auth | Existing `SERVER_API_KEY` / tenant key. |
| A8 | `[AUTO]` Card count helper | Add `countCardsByRepo(id): number` via SQL `COUNT(*)` (not `listCards().length`). |
| A9 | `[AUTO]` Delete confirm UX | Dedicated confirm **dialog** (`role="dialog"`), not `window.confirm`. |
| A10 | `[AUTO]` Board entry link | **Include** thin "projects" link on `/ui/board` header → `/#projects`. No CRUD on Kanban. |
| A11 | `[AUTO]` Modal fields | Create/edit: `name`, `remote_url`, `secret_ref` only. Omit `local_path` (server default under `REPOS_ROOT`; advanced override stays API-only). |
| A12 | `[AUTO]` 409 body | `{ error: "Cannot delete repository: N card(s) still reference it" }` (`N` = count). UI shows `body.error`. Keep "repository" wording to match existing duplicate-name 409s. |
| A13 | `[AUTO]` Active-run gate | No extra `active_run_id` check; any card presence already soft-blocks. |
| A14 | `[AUTO]` Concurrency | Check-then-delete without SQLite transaction OK for single-operator homelab. |
| A15 | `[AUTO]` ensure-clone in Projects UI | Out of scope. |
| A16 | `[AUTO]` Hard delete | No soft-delete column; empty project is hard-removed. |
| A17 | `[AUTO]` Verify command | AC7 includes `npm test` (build + `node --test`) in addition to typecheck / build / scan-secrets. |

### Acceptance Criteria (measurable)

| AC | Criterion | Done when |
|----|-----------|-----------|
| AC1 | Authenticated project CRUD + 400/404/409 | Existing `/board/repos` CRUD retained; soft-block delete adds 409-when-cards; validation unchanged |
| AC2 | List suitable for UI | `GET /board/repos` returns id, name, remote_url, secret_ref, local_path, timestamps; empty OK |
| AC3 | Editable config; no secret leak | Modal edits name / remote_url / secret_ref; responses never include resolved token |
| AC4 | Projects list + create/open-edit | Dashboard Projects pane lists projects with Create + Edit; board header links to `/#projects` |
| AC5 | Modal create/edit | Dialogs (not full-page); Cancel discards; Save POST/PUT then refresh list |
| AC6 | Delete confirm + soft-block | Confirm dialog; DELETE succeeds when no cards; 409 when cards reference repo; UI surfaces error without navigation |
| AC7 | Verify + tests | `npm run typecheck`, `npm run build`, `npm run scan-secrets`, `npm test`; route/UI tests for CRUD happy path + 401 + delete 409 |

### Out of scope (hard)

- Changing Start/Pause/Finish / lane rules (`34`)
- Prompt widget (`35`) / new runners
- New `projects` table or rename of `repos` / `repo_id`
- Full repo CRUD embedded in `/ui/board` Kanban chrome
- Real remote clone in CI
- Projects-pane ensure-clone / cleanup-clone / import-specs actions
- `local_path` editing in modals
- `/board/projects` aliases or dual JSON envelopes

### Complexity (orch)

**complex** — soft-block API change + dashboard modal CRUD + board discoverability link + tests + ship-time doc sync. Expect ~8–10 files; exceeds `dagThresholds`. Use full `ws-spec-to-pr`, not lite.

---

## 2. Technical Design & Architecture

### Evidence map (baseline @ `2d6e850` / current tree)

| Area | Status | Evidence |
|------|--------|----------|
| SQLite `repos` table | **Done** | `board-db.ts` ~99–107 (`name` UNIQUE, `remote_url`, `secret_ref`, `local_path`, timestamps) |
| Cards FK CASCADE | **Done (risk)** | `board-db.ts` ~110 `REFERENCES repos(id) ON DELETE CASCADE` |
| Duplicate name 409 | **Done** | `board.ts` create/update `getRepoByName` → 409 |
| `listRepos` / CRUD service | **Done** | `board-db.ts` ~256–339 |
| HTTP `/board/repos` CRUD | **Done** | `board.ts` ~133–260 |
| Auth on `/board` | **Done** | `index.ts` ~77–79; `board.test.ts` ~73–76 |
| `secret_ref` ref-only responses | **Done** | `board.ts` `repoResponse` ~87–97 |
| Delete soft-block when cards | **Gap** | `board.ts` ~241–259 deletes unconditionally; cleans clone first |
| Dashboard Projects list stub | **Partial** | `dashboard-page.ts` ~251–258 stub; `loadProjects` ~474–497 read-only |
| Create/edit/delete modals | **Gap** | No project modal markup/JS in `dashboard-page.ts` |
| Board → projects link | **Gap** | `ui.ts` header.sub has prompt/spec-editor only (~272) |
| Delete-with-cards 409 test | **Gap** | Missing in `board.test.ts` |
| Dashboard stub assertion | **Stub-era** | `dashboard.test.ts` ~76 asserts `39-board-projects-management` placeholder |

### Project vs repo (canonical)

```text
UI label:  "Project"
API/DB:    board repos (/board/repos, table repos, cards.repo_id)
Meaning:   1:1 alias — operators manage clone/remote + secret_ref for a named workspace
```

**Rationale for no `/board/projects` aliases:** AC requires project CRUD capability, not a new path. Spec 32 + Kanban already call `/board/repos`. Aliases would duplicate handlers and force a second JSON envelope without AC gain.

### Layer edits

| Layer | Files | Change |
|-------|-------|--------|
| **Services** | `src/services/board-db.ts` | Add `countCardsByRepo(repoId): number` (`SELECT COUNT(*) FROM cards WHERE repo_id = ?`) |
| **Routes** | `src/routes/board.ts` | Soft-block delete: count → 409 **before** `cleanupClone` / `deleteRepo` |
| **Routes / UI** | `src/routes/dashboard-page.ts` | Replace stub with CRUD list + create/edit/delete confirm modals; wire to `/board/repos` |
| **Routes / UI** | `src/routes/ui.ts` | Thin header link "projects" → `/#projects` |
| **Tests** | `src/routes/board.test.ts` | Delete empty OK; delete with cards → 409; cards + repo remain |
| **Tests** | `src/routes/dashboard.test.ts` | Modal markers / Create button; drop stub-string assertion |
| **Tests** | `src/routes/ui.test.ts` | Assert `/#projects` (or "projects") link present if file already covers board HTML |
| **Docs** | `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`, human + plan specs status | Status sync when feature ships (MEMORY: packaging/status doc sync) |

### Soft-block delete (exact behavior)

```text
DELETE /board/repos/:id
  1. parse id → 400 if invalid
  2. getRepo → 404 if missing
  3. tenant access → 403 if denied
  4. n = countCardsByRepo(id)
     if n > 0 → 409 { error: "Cannot delete repository: N card(s) still reference it" }
  5. cleanupClone (ignore invalid path)
  6. deleteRepo(id)
  7. 200 { ok: true }
```

Do **not** reorder 4 after 5.

### Modal UX (dashboard)

Mirror existing patterns:
- Login gate already uses `role="dialog"` / `aria-modal` (`dashboard-page.ts` ~212).
- Kanban start modal CSS/JS in `ui.ts` is a style reference only; keep dashboard self-contained (same CSS variables: `--accent` `#3d8bfd`, no purple-gradient).

**Create modal (`#project-modal` create mode):** fields `name`, `remote_url`, `secret_ref` (all required). Save → `POST /board/repos` → refresh list. On 409/400 show `body.error`.

**Edit modal (same dialog, edit mode):** prefill from list/get; Save → `PUT /board/repos/:id`.

**Delete confirm (`#project-delete-modal` or confirm section):** explicit Confirm/Cancel; Confirm → `DELETE /board/repos/:id`. On 409 show error and keep list/modal state (do not navigate away). On 200 close + refresh.

**Cancel:** close modal; discard form state (no PUT/POST).

**List row:** name + remote summary + **Edit** / **Delete** actions (`data-id`). Keep `escapeHtml` for name/remote.

**Toolbar:** **New project** button (`#btn-project-new`).

**Marker ids (for tests):** `btn-project-new`, `project-modal`, `project-delete-modal` (or equivalent stable ids asserted in `dashboard.test.ts`).

### Board discoverability

In `ui.ts` header `.sub`, add link alongside prompt / spec-editor:

```html
<a href="/#projects" style="color:var(--accent)">projects</a>
```

Hash soft-nav already opens Projects pane (`dashboard-page.ts` ~457).

### Invariant checks (`config.json.invariants`)

| Invariant | How plan respects |
|-----------|-------------------|
| `thinRoutesNoBusinessLogic` | Card-count gate in route calling `boardDb.countCardsByRepo` |
| `secretsFromEnvOnly` / no leak | Keep returning `secret_ref` name only |
| `noHardcodedRepoAbsolutePaths` | Continue `resolveRepoLocalPath(REPOS_ROOT, …)` |
| `commitPlanFilesOnlyAtStep8` | Plan under `{plansDir}` not git-added this step |
| `localSdkRuntimeOnly` | Untouched |

### Fable domain

`fable.enabled` + `autoDetectDomain`: no new IaC/K8s/Docker/migration framework. Soft-block is a small SQLite query in existing board DB. No `ws-fable-domain` binding required.

Ops frauds to avoid: claiming CRUD done while stub text remains; claiming soft-block while CASCADE still fires on non-empty repos; leaking resolved secrets in list/get tests.

---

## 3. Step-by-Step Plan

### Step 1 — Soft-block delete (DB + API)

**Action:**
1. Add `countCardsByRepo(id: number): number` on `BoardDatabase` (SQL `COUNT(*)`).
2. In `DELETE /board/repos/:id`, after auth/404: if count > 0 return `409` with locked message shape.
3. Only then cleanup clone + `deleteRepo`.

**Files:** `src/services/board-db.ts`, `src/routes/board.ts`

**Checks:** Empty delete still 200 `{ ok: true }`; delete with cards 409, row + cards remain, clone not cleaned when blocked.

### Step 2 — Backend tests for delete policy + CRUD regression

**Action:**
1. Extend `board.test.ts`: create repo + card → DELETE → 409; list still has repo; delete card then DELETE → 200.
2. Keep existing CRUD + 401 + secret_ref non-leak assertions.
3. Use short stubs (`CURSOR_API_KEY: "test-key"`) per MEMORY scan-secrets trap.

**Files:** `src/routes/board.test.ts` (optional tiny count assert in `board-db.test.ts`)

**Checks:** `npm test` green for new cases.

### Step 3 — Dashboard Projects CRUD UI (modals)

**Action:**
1. Remove placeholder-note / "lands in 39" copy.
2. Add toolbar: **New project** button.
3. List rows: name, remote summary, actions **Edit** / **Delete**.
4. Add create/edit modal + delete confirm modal markup + CSS (dashboard tokens).
5. Wire JS: POST create, PUT update, DELETE with confirm dialog; on success `loadProjects()`; on 409 show error text.
6. Cancel closes and resets form fields.
7. Keep calling `/board/repos` (response key `repos`); label UI "Projects".

**Files:** `src/routes/dashboard-page.ts`

**Checks:** HTML contains create/edit/delete modal ids + `/board/repos` fetch paths; no full-page form routes; stub slug string gone.

### Step 4 — Dashboard / UI tests

**Action:**
1. Update `dashboard.test.ts`: assert Projects pane has create/edit affordances (`btn-project-new`, `project-modal`, absence of stub slug string).
2. Assert `/ui/board` still 200 (existing regression OK).
3. Do **not** require browser MCP for AC7; static HTML + API route tests suffice for CI.

**Files:** `src/routes/dashboard.test.ts`

### Step 5 — Board entry affordance (thin) — **include**

**Action:** Add "projects" link on `/ui/board` header.sub → `/#projects`. No CRUD duplication.

**Files:** `src/routes/ui.ts`, `src/routes/ui.test.ts` if HTML assertions exist / are cheap to add

### Step 6 — Docs / status sync (same ship turn)

**Action:** When implementation lands (Step 4/8 delivery), update:
- `README.md` Ops UI row / `GET /` Projects stub note
- `AGENTS.md` Planned areas (mark 39 shipped)
- `.agents/specs/index.PRD` Next → Done for 39
- Spec frontmatter `status` on human + plan mirrors

**Checks:** No contradiction "stub until 39" left behind (MEMORY status-doc trap).

### Step 7 — Verification gate

Run:
- `npm run typecheck`
- `npm run build`
- `npm run scan-secrets`
- `npm test`

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
| AC1 | Unauth GET `/board/repos` → 401 | `board.test.ts` (existing) |
| AC1 | POST/GET/PUT happy path | `board.test.ts` (existing) |
| AC1/AC6 | DELETE with cards → 409; without → 200 | **New** soft-block test |
| AC2 | List returns fields; empty OK | Existing list assert |
| AC3 | Response `secret_ref` equals env name; body lacks token value | Existing CRUD test |
| AC3 | Invalid body → 400 | Zod path (existing / minimal add if missing) |
| AC4/AC5 | Dashboard HTML has Projects pane + modal create/edit markers | `dashboard.test.ts` (update) |
| AC4 | Board HTML links to `/#projects` | `ui.test.ts` or board HTML assert |
| AC6 | Delete confirm affordance in HTML | `dashboard.test.ts` |
| AC7 | typecheck / build / scan-secrets / `npm test` | Shell verification |
| AC7 | No real remotes | Tests use fake URLs + env `secret_ref` only |

MEMORY: Config stubs use short API keys (`"test-key"` / `"fake-board-key"`), not long descriptive fakes.

---

## 6. Invariants (Do Not Violate)

1. **Local SDK only** — no cloud runtime changes.
2. **Thin routes** — HTTP validation + `boardDb` calls; no clone/exec logic in dashboard HTML beyond fetch.
3. **No hardcoded absolute repo paths** — always via `REPOS_ROOT` helpers.
4. **Secrets from env/files via `secret_ref` only** — never store or echo resolved tokens.
5. **Dispose agents** — N/A (no new agent runs).
6. **`settingSources: []`** — N/A.
7. **Plan files** — do not commit under `{plansDir}` until Step 8.
8. **No scope creep** — do not touch execution lanes, prompt widget, or runners.
9. **No new parent entity** — project ≡ repo alias.
10. **Soft-block before cleanup** — never `cleanupClone` when card count > 0.

---

## 7. Pre-PR Checklist

- [ ] Layer boundaries respected (routes thin; UI in `dashboard-page.ts`; count helper in `board-db.ts`).
- [ ] No new domain entity / no `projects` table / no `/board/projects`.
- [ ] Soft-block delete **before** CASCADE / cleanup path.
- [ ] Authorization unchanged on `/board/*`.
- [ ] i18n N/A (English only).
- [ ] Tests cover AC1–AC7 (API + HTML markers + verify commands including `npm test`).
- [ ] Dashboard stub text / `39-board-projects-management` placeholder removed; tests updated.
- [ ] Board header link to `/#projects` present.
- [ ] Docs status sync (README / AGENTS / index.PRD) on ship.
- [ ] `scan-secrets` clean; test keys short (`test-key` / `fake-board-key`).

---

## 8. Open Questions

**None remaining.** All planning questions resolved for implement (locked L1–L5 + `[AUTO]` A8–A17).

| Topic | Decision |
|-------|----------|
| Project vs repo | Alias UX over `repos` / `/board/repos` |
| `/board/projects` aliases | **Not** added |
| UI host | Dashboard Projects pane + modals |
| Board link | Include thin `/#projects` link |
| Display name | Existing `name` |
| Delete | Soft-block 409 when cards exist; check before cleanup |
| Confirm UX | Dedicated dialog (not `window.confirm`) |
| Modal fields | name, remote_url, secret_ref (no local_path) |
| Pagination | Complete list only |
| Count helper | SQL `COUNT(*)` |

---

## Appendix — File touch list (expected)

| Path | Role |
|------|------|
| `src/services/board-db.ts` | `countCardsByRepo` |
| `src/routes/board.ts` | Delete soft-block (pre-cleanup) |
| `src/routes/board.test.ts` | 409 delete tests |
| `src/routes/dashboard-page.ts` | Projects CRUD modals |
| `src/routes/dashboard.test.ts` | UI marker assertions |
| `src/routes/ui.ts` | Manage-projects / projects link |
| `src/routes/ui.test.ts` | Optional link assert |
| `README.md` / `AGENTS.md` / `.agents/specs/index.PRD` | Status sync at ship |
| `.agents/specs/39-board-projects-management.spec.md` | Status frontmatter at ship |

**Do not invent:** new migration framework, new ORM, React SPA, `/board/projects` router, parent `projects` table, soft-delete column, Projects-pane clone actions.

---

## Interview registry

| id | class | section | gap | recommendation | status | resolution | dependsOn |
|----|-------|---------|-----|----------------|--------|------------|-----------|
| G1 | blocking | 2 / delete | Current DELETE cleans clone before row delete; soft-block must precede cleanup | Check card count after 404/auth; 409 before `cleanupClone` | resolved | Locked ordering in §2 Soft-block delete | — |
| G2 | non-blocking | 2 / DB | COUNT vs `listCards().length` | Prefer SQL `COUNT(*)` helper | resolved | `[AUTO]` A8 `countCardsByRepo` | — |
| G3 | non-blocking | 2 / UX | `window.confirm` vs dedicated dialog | Dedicated `role="dialog"` confirm | resolved | `[AUTO]` A9 | — |
| G4 | non-blocking | 3 / Step 5 | Optional board link ambiguous | Include thin `/#projects` link | resolved | `[AUTO]` A10 include | — |
| G5 | non-blocking | 2 / fields | Whether modals expose `local_path` | Omit; server default under `REPOS_ROOT` | resolved | `[AUTO]` A11 | — |
| G6 | non-blocking | probes / concurrency | Race: card insert between count and delete | Accept check-then-delete for MVP | resolved | `[AUTO]` A14 | — |
| G7 | non-blocking | probes / active run | Extra gate on `active_run_id`? | No; any card soft-blocks | resolved | `[AUTO]` A13 | — |
| G8 | non-blocking | probes / soft-delete | Soft-delete column vs hard delete | Hard delete when empty | resolved | `[AUTO]` A16 | — |
| G9 | non-blocking | 2 / contract | Exact 409 message shape | `{ error: "Cannot delete repository: N card(s) still reference it" }` | resolved | `[AUTO]` A12 | G1 |
| G10 | non-blocking | 5 / UX | Surface duplicate-name 409 in modal | Show `body.error` (API already returns 409) | resolved | Document in modal UX | — |
| G11 | non-blocking | 1 / scope | ensure-clone from Projects pane? | Out of scope | resolved | `[AUTO]` A15 | — |
| G12 | non-blocking | probes / list size | Pagination needed? | Complete list only (already A4) | resolved | Confirmed | — |
| G13 | non-blocking | probes / rate limits | Board rate limits? | N/A for this feature | resolved | No change | — |
| G14 | non-blocking | 5 / verify | AC7 command set | Include `npm test` | resolved | `[AUTO]` A17 | — |
| G15 | blocking | 1 / domain | Project vs repo still open in workflow Open items | Alias UX (Step 1 locked) | resolved | L1; state Open items cleared by orch after Step 2 | — |
