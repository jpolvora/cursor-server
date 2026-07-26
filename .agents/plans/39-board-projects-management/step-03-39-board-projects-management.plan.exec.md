---
slug: 39-board-projects-management
step: 3
title: "Execution plan — Board projects management (CRUD, soft-block, modals)"
execMode: parallel
planPath: .agents/plans/39-board-projects-management/step-02-39-board-projects-management.plan.refined.md
dagPath: .agents/plans/39-board-projects-management/step-03-39-board-projects-management.exec.dag.json
status: ready
---

# Step 3 — Execution plan & DAG

## Size detection vs `dagThresholds`

| Metric | Counted from refined plan | Threshold | Within? |
|--------|---------------------------|-----------|---------|
| Implementation steps | **5** (plan Steps 1–5: soft-block API, board tests, dashboard UI, dashboard tests, board link); Steps 6–7 = ship docs + verify | maxImplementationSteps: **3** | **NO** |
| Expected files | **7+** product/test paths (`board-db.ts`, `board.ts`, `board.test.ts`, `dashboard-page.ts`, `dashboard.test.ts`, `ui.ts`, `ui.test.ts`) + docs at ship | maxExpectedFiles: **6** | **NO** |
| Layers | **2** (services, routes/UI) | maxLayers: **2** | **YES** (at limit) |

**Decision:** `execMode: parallel` — steps and files exceed thresholds. Useful parallel levels exist (no shared-file collisions): soft-block DB, dashboard CRUD UI, and board header link are independent on L0.

Source plan: `.agents/plans/39-board-projects-management/step-02-39-board-projects-management.plan.refined.md`.

## Layer map

| Layer | Files | Tasks |
|-------|-------|-------|
| services | `src/services/board-db.ts` | T1 |
| routes (API) | `src/routes/board.ts`, `src/routes/board.test.ts` | T2 → T3 |
| routes (UI) | `src/routes/dashboard-page.ts`, `src/routes/dashboard.test.ts` | T4 → T5 |
| routes (board chrome) | `src/routes/ui.ts`, `src/routes/ui.test.ts` | T6 |
| docs (ship turn) | `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`, human + plan spec status | T7 |

## DAG levels

```text
L0: T1 (countCardsByRepo) │ T4 (dashboard CRUD modals) │ T6 (board → /#projects)
L1: T2 (DELETE soft-block) │ T5 (dashboard.test markers)
L2: T3 (board.test 409)
L3: T7 (docs/status sync + verify)
```

Machine DAG: `.agents/plans/39-board-projects-management/step-03-39-board-projects-management.exec.dag.json`.

Max 3 concurrent per level; no file overlap within a level.

## Tasks

### T1 — Soft-block card-count helper
- **parallelGroup:** L0
- **dependsOn:** none
- **files:** `src/services/board-db.ts`
- **ACs:** AC1 / AC6 foundation
- **Maps plan:** Step 1 (DB half)
- **Coder prompt:** In `src/services/board-db.ts`, add `countCardsByRepo(repoId: number): number` on `BoardDatabase` using SQL `SELECT COUNT(*) FROM cards WHERE repo_id = ?` (not `listCards().length`). Return integer `0` when none. No route/UI/docs changes. No new table. No commit. Do not stage `.agents/plans/`.

### T2 — Soft-block DELETE before cleanup
- **parallelGroup:** L1
- **dependsOn:** T1
- **files:** `src/routes/board.ts`
- **ACs:** AC1, AC6
- **Maps plan:** Step 1 (API half)
- **Coder prompt:** In `DELETE /board/repos/:id` (`src/routes/board.ts`), after parse/getRepo/tenant checks: `n = boardDb.countCardsByRepo(id)`; if `n > 0` return **409** `{ error: "Cannot delete repository: N card(s) still reference it" }` (**before** `cleanupClone` / `deleteRepo`). Empty repo: keep existing cleanup + delete → 200 `{ ok: true }`. Do not reorder check after cleanup. Keep `repoResponse` secret_ref-only. Thin route; no dashboard/UI edits. No commit.

### T3 — Board delete 409 + regression tests
- **parallelGroup:** L2
- **dependsOn:** T2
- **files:** `src/routes/board.test.ts`
- **ACs:** AC1, AC6, AC7
- **Maps plan:** Step 2
- **Coder prompt:** Extend `src/routes/board.test.ts`: (1) create repo + card → DELETE → 409 with locked error shape; list still has repo; cards remain; (2) delete card then DELETE → 200 `{ ok: true }`. Keep existing CRUD / 401 / secret_ref non-leak asserts. Config stubs: `CURSOR_API_KEY: "test-key"` or `"fake-board-key"` (MEMORY scan-secrets — no long fake keys). No product code beyond test. No commit.

### T4 — Dashboard Projects CRUD modals
- **parallelGroup:** L0
- **dependsOn:** none
- **files:** `src/routes/dashboard-page.ts`
- **ACs:** AC3, AC4, AC5, AC6
- **Maps plan:** Step 3
- **Coder prompt:** In `src/routes/dashboard-page.ts`, replace Projects stub / “lands in 39” copy with CRUD UX over `/board/repos` (response key `repos`; UI labels “Projects”). Add toolbar `#btn-project-new`; list rows with name, remote summary, Edit/Delete (`data-id`); create/edit modal `#project-modal` (`role="dialog"`) fields `name`, `remote_url`, `secret_ref` only (no `local_path`); delete confirm `#project-delete-modal` (dedicated dialog, not `window.confirm`). Wire POST create, PUT update, DELETE with confirm; success → `loadProjects()`; 400/409 → show `body.error` without navigation; Cancel discards form. Keep `escapeHtml`, existing API-key sessionStorage, CSS tokens (`--accent #3d8bfd`; no purple-gradient). No ensure-clone / cleanup-clone buttons. No `/board/projects` aliases. No edits to `board.ts` / `ui.ts` in this task. No commit.

### T5 — Dashboard UI marker tests
- **parallelGroup:** L1
- **dependsOn:** T4
- **files:** `src/routes/dashboard.test.ts`
- **ACs:** AC4, AC5, AC6, AC7
- **Maps plan:** Step 4
- **Coder prompt:** Update `src/routes/dashboard.test.ts`: assert Projects pane has `btn-project-new`, `project-modal`, delete-confirm affordance (`project-delete-modal` or equivalent); assert stub slug / “lands in 39” string **absent**; keep GET `/` 200 HTML + existing shell markers; `/ui/board` still 200 OK if already asserted. No browser MCP required. Short API-key stubs only. No product edits beyond test expectations. No commit.

### T6 — Board header → /#projects link
- **parallelGroup:** L0
- **dependsOn:** none
- **files:** `src/routes/ui.ts`, `src/routes/ui.test.ts`
- **ACs:** AC4
- **Maps plan:** Step 5
- **Coder prompt:** In `src/routes/ui.ts` board header `.sub`, add thin link `<a href="/#projects" …>projects</a>` beside prompt / spec-editor. No Kanban CRUD duplication. Extend `src/routes/ui.test.ts` to assert `/#projects` (or “projects” href) present in board HTML if assertions already exist / are cheap. Do not edit dashboard-page or board API. No commit.

### T7 — Docs status sync + verification gate
- **parallelGroup:** L3
- **dependsOn:** T2, T3, T4, T5, T6
- **files:** `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`, `.agents/specs/39-board-projects-management.spec.md`
- **ACs:** AC7 + ship-status consistency
- **Maps plan:** Steps 6–7
- **Coder prompt:** Same turn as feature landing (MEMORY packaging/status doc sync): remove “Projects stub until 39” / “next is 39” contradictions from `README.md` and `AGENTS.md`; move `39` Next → Done in `.agents/specs/index.PRD`; set human spec (and plan mirror if needed) `status` to reflect shipped/implemented. Run `npm run typecheck`, `npm run build`, `npm run scan-secrets`, `npm test`. Diff audit: no OOS `src/` (MEMORY docs-implement scope-creep). Do **not** stage `.agents/plans/`. No commit unless orch/ship requests.

## Plan step → task map

| Plan step | Task(s) |
|-----------|---------|
| Step 1 — Soft-block delete (DB + API) | T1 → T2 |
| Step 2 — Backend delete tests | T3 |
| Step 3 — Dashboard Projects CRUD UI | T4 |
| Step 4 — Dashboard / UI tests | T5 |
| Step 5 — Board entry affordance | T6 |
| Step 6 — Docs / status sync | T7 |
| Step 7 — Verification gate | T7 (end) |

## Locked decisions (do not reopen)

- Project = alias UX over `repos` / `/board/repos` (no new table, no `/board/projects`)
- Soft-block 409 when cards exist; check **before** `cleanupClone`
- 409 body: `{ error: "Cannot delete repository: N card(s) still reference it" }`
- Primary CRUD in dashboard Projects pane modals; board gets thin `/#projects` link only
- Modal fields: `name`, `remote_url`, `secret_ref` (no `local_path`)
- Confirm = dedicated dialog, not `window.confirm`

## Invariants (do not violate)

- `thinRoutesNoBusinessLogic` — count helper in `board-db`; route calls it
- `secretsFromEnvOnly` — `secret_ref` name only; short test keys
- `noHardcodedRepoAbsolutePaths` — `REPOS_ROOT` helpers only
- Soft-block **before** cleanup / CASCADE path
- No new parent entity / no soft-delete column / no Projects-pane clone actions
- `commitPlanFilesOnlyAtStep8` — do not git-add `{plansDir}` this step
- Surgical scope: no lanes (`34`), prompt widget (`35`), runners

## Handoff

- Human-readable: `.agents/plans/39-board-projects-management/step-03-39-board-projects-management.plan.exec.md`
- Machine DAG: `.agents/plans/39-board-projects-management/step-03-39-board-projects-management.exec.dag.json`
- Next skill: `ws-implement-tasks` with `execMode: parallel` (dispatch per level, ≤3 concurrent)
- Orchestrator: set state `execMode: parallel`
