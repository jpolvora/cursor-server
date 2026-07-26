---
slug: 39-board-projects-management
step: 6
base: HEAD (uncommitted working tree on develop)
reviewedAt: "2026-07-26T10:30:00Z"
reviewer: ws-code-review (Step 6)
autoMode: true
fullMode: true
planPath: .agents/plans/39-board-projects-management/step-02-39-board-projects-management.plan.refined.md
---

# Step 6 — Code Review: 39-board-projects-management

**Scope:** Board projects CRUD (alias UX over `/board/repos`), soft-block delete, dashboard modals, board discoverability link, docs status sync.  
**In-scope files (vs HEAD):** `src/services/board-db.ts`, `src/routes/board.ts`, `src/routes/board.test.ts`, `src/routes/dashboard-page.ts`, `src/routes/dashboard.test.ts`, `src/routes/ui.ts`, `src/routes/ui.test.ts`, `README.md`, `AGENTS.md`, `.agents/specs/index.PRD`, `.agents/specs/39-board-projects-management.spec.md`.  
**Excluded:** `dist/`, `node_modules/`, plan artifacts except this report, OOS harness/execution/prompt/runner paths.  
**MEMORY applied:** soft-block before cleanup; `secret_ref` non-leak; scan-secrets short stubs (`test-key`); status doc sync; scope-creep guard; already-implemented skepticism.

## Diff inventory

| Path | Status |
|------|--------|
| `src/services/board-db.ts` | modified — `countCardsByRepo` SQL `COUNT(*)` |
| `src/routes/board.ts` | modified — DELETE soft-block 409 **before** `cleanupClone` / `deleteRepo` |
| `src/routes/board.test.ts` | modified — soft-block 409 + empty-delete 200 cases |
| `src/routes/dashboard-page.ts` | modified — Projects CRUD modals + list actions |
| `src/routes/dashboard.test.ts` | modified — modal markers; stub slug assert removed |
| `src/routes/ui.ts` | modified — header `projects` → `/#projects` |
| `src/routes/ui.test.ts` | modified — assert `href="/#projects"` |
| `README.md` / `AGENTS.md` / `index.PRD` / human spec | modified — status sync (39 shipped) |

Blast radius **11 files, +392/−26** — matches refined-plan appendix (+ docs). No OOS `src/` (no `/board/projects`, no `projects` table, no lane/execution/`prompt`/runner edits).

## AC / focus cross-check

| Focus / AC | Verdict | Evidence |
|------------|---------|----------|
| Soft-block ordering (before `cleanupClone`) | **Pass** | `board.ts:251-257` count+409; `cleanupClone` only at `259-261` after gate |
| `countCardsByRepo` SQL COUNT | **Pass** | `board-db.ts:341-352` — not `listCards().length` |
| `secret_ref` never leaks resolved secrets | **Pass** | `repoResponse` returns ref name only (`board.ts:87-97`); CRUD test asserts no `"fake-token"` (`board.test.ts:89-91`); modal edits env name only |
| Modal UX create/edit | **Pass** | `#project-modal` `role="dialog"`; fields name/remote_url/secret_ref; Cancel → `closeProjectModal` → `resetProjectForm`; Save POST/PUT then `loadProjects` |
| Delete confirm + soft-block UX | **Pass** | `#project-delete-modal` dialog (no `window.confirm`); Confirm DELETE; 409 → `projectDeleteError` + return (no close/nav) |
| Board entry link | **Pass** | `ui.ts:272` + `ui.test.ts` `href="/#projects"` |
| Test stubs short | **Pass** | `CURSOR_API_KEY: "test-key"`; `SERVER_API_KEY: "fake-board-key"` |
| Docs consistency | **Pass** (human-facing) | README Ops UI landed; AGENTS purpose + shipped recently; `index.PRD` Next empty + Done log; human spec `status: shipped`; no “stub until 39” left in product docs |
| No OOS scope creep | **Pass** | Grep clean for `/board/projects`, ensure-clone/cleanup-clone in Projects pane, `local_path` modal fields |

## Triage → investigate

| Hypothesis | Result |
|------------|--------|
| Soft-block runs **after** `cleanupClone` (clone wiped on 409) | **Discarded** — gate inserted above existing cleanup block; early `return` on `n > 0` |
| Resolved secret echoed in list/get/modal | **Discarded** — `repoResponse.secret_ref` is env name; tests assert absence of token value; modal prefills ref name |
| Delete via `window.confirm` / no confirm dialog | **Discarded** — dedicated `#project-delete-modal`; no `window.confirm` in `dashboard-page.ts` |
| Cancel leaves dirty form / still saves | **Discarded** — Cancel calls `closeProjectModal` → `resetProjectForm` (clears fields + `editProjectId`) |
| 409 delete navigates away / closes without error | **Discarded** — `confirmDeleteProject` sets error text and `return`s; modal stays open |
| XSS via project name in list / delete message | **Discarded** — list uses `escapeHtml`; delete message uses `textContent` |
| `/board/projects` or new `projects` table | **Discarded** — no matches under `src/` |
| Long `CURSOR_API_KEY` stubs trip scan-secrets | **Discarded** — `"test-key"` / `"fake-board-key"` (MEMORY-compliant) |
| Human docs still say “Projects stub / next = 39” | **Discarded** — README/AGENTS/`index.PRD` updated; dashboard stub copy gone; tests assert absence |
| Plan mirror `step-00` still `status: draft` | **Retained → Nit** (workflow artifact; human-facing docs consistent) |
| Soft-block test omits clone FS assert | **Retained → Nit** (ordering proven in code; optional harden from Step 5) |
| Whole-suite `npm test` red (harness 404) | **Discarded as 39 finding** — pre-existing / OOS per Step 5; feature suites green |

## Critical

_No feedback_

## Warning

_No feedback_

## Nit / Suggestion

### N1 — Plan-mirror spec frontmatter still `draft`

- **path:** `.agents/plans/39-board-projects-management/step-00-39-board-projects-management.spec.md:7`
- **score:** 2/10
- **Evidence Read:** Human spec `.agents/specs/39-board-projects-management.spec.md` is `status: shipped`; plan mirror remains `draft`. Step 5 already flagged this.
- **Failure Scenario:** Workflow readers glance at plan mirror and think feature unfinished; human-facing index/README/AGENTS already say shipped.
- **Missing Protection:** Plan Step 6 asked for “human + plan mirrors”; mirror not updated (plansDir usually Step 8).
- **Discards:** Not Warning — MEMORY status-doc trap targets **human-facing** contradictions (README/AGENTS/index); those are clean.
- **Sibling occurrences:** None in ship-scoped docs.
- **suggestion:** At Step 8 / ship, set plan-mirror `status: shipped` (or leave as historical workflow copy — optional).

### N2 — Soft-block test does not assert clone tree untouched

- **path:** `src/routes/board.test.ts:305-347`
- **score:** 2/10
- **Evidence Read:** Test asserts 409 + repo/card retention; does not seed a clone dir and assert it still exists after blocked DELETE.
- **Failure Scenario:** Future reorder of cleanup before count could wipe disk while tests still pass on DB rows.
- **Missing Protection:** FS assert optional (Step 5 “optional harden”); source ordering currently correct.
- **Discards:** Not Warning — invariant holds in `board.ts` with clear early return.
- **suggestion:** Optional: create marker file under repo `local_path`, DELETE → 409, assert file remains.

### N3 — Optional `countCardsByRepo` unit in `board-db.test.ts`

- **path:** (absent) — plan marked optional
- **score:** 1/10
- **suggestion:** Add only if wanting service-layer coverage beyond route tests.

## Invariants (`config.json.invariants`)

| Invariant | Result |
|-----------|--------|
| `localSdkRuntimeOnly` | **Pass** — no SDK/runtime changes |
| `thinRoutesNoBusinessLogic` | **Pass** — count via `boardDb.countCardsByRepo`; route remains HTTP+gate |
| `noHardcodedRepoAbsolutePaths` | **Pass** — still `resolveRepoLocalPath(REPOS_ROOT, …)` |
| `secretsFromEnvOnly` | **Pass** — `secret_ref` name only in API/UI |
| `disposeAgentsAlways` / `settingSourcesEmptyUnlessIntentional` | **N/A** |
| `commitPlanFilesOnlyAtStep8` | **Pass** — review writes under `{plansDir}` only; no staging |
| Tenancy | **Pass** — existing `checkRepoTenantAccess` before count |
| i18n | **N/A** (`frontend.i18n.framework: none`) |

## MEMORY pattern sweep

| Pattern | Result |
|---------|--------|
| scan-secrets short stubs | **Pass** |
| Packaging / status doc sync | **Pass** (human-facing); plan-mirror Nit only |
| Docs implement scope creep | **Pass** — no OOS `src/` |
| Already-implemented false positives | **Pass** — soft-block + modals are real (not stub symbols) |

## Fable light audit (`fable.enabled` + `autoAudit`)

**Verdict:** `VERIFIED` for this diff (no Critical/Warning frauds in product code).

| Check | Result |
|-------|--------|
| Claims vs diff | Soft-block, count helper, modals, board link, tests, docs match blast radius |
| Weakened checks | None — new tests tighten 409 message + retention |
| False completion | No — ACs have file:line evidence; suite-wide harness red is OOS caveat only |
| Scope creep | None |
| Unauthorized action | None (review-only; no push/deploy) |

## Verdict

**Clean for fix gate:** **0 Critical, 0 Warning.**  
Nits N1–N3 are optional and do **not** require `ws-implement-tasks mode=fix`.

**Apply fixes?** No — skip fix substep; advance Step 6 → Step 7.

---

## step-output

```yaml
status: clean
critical: 0
warning: 0
nit: 3
artifacts:
  - .agents/plans/39-board-projects-management/step-06-39-board-projects-management.review.md
summary: >
  Soft-block runs before cleanupClone; secret_ref stays ref-only; modal
  create/edit/delete+cancel and 409 UX match ACs; no OOS creep; short test
  keys; human-facing docs consistent. No Critical/Warning — skip fix substep.
  Optional nits: plan-mirror status, clone FS assert, count unit test.
```
