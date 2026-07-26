---
us: "39-board-projects-management"
reportDate: 2026-07-26
score: 9
sourcePlans: ["step-02-39-board-projects-management.plan.refined.md"]
evalSource: step-02-39-board-projects-management.plan.refined.md
githubSource: none
fableVerdict: "VERIFIED WITH CAVEATS"
---

# Implementation Report - 39-board-projects-management

**Generated on:** 2026-07-26
**Score:** 9/10
**Evaluation source:** step-02-39-board-projects-management.plan.refined.md
**Reference Plan:** step-02-39-board-projects-management.plan.refined.md

Skeptical FULL verify (MEMORY: already-implemented false positives). Every AC mapped with file:line; stubs / symbol-only matches rejected.

## Result by Feature (Plan & ACs)

| Feature | Situation | Detail / Evidence |
|---------|-----------|-------------------|
| AC1 Authenticated project CRUD + 400/404/409 | **Implemented** | `/board/repos` CRUD retained: `board.ts:133-238` (GET/POST/GET:id/PUT). Soft-block DELETE: `board.ts:241-268` — `countCardsByRepo` then 409 before cleanup. Auth 401: `board.test.ts:73-76`. Duplicate-name 409 retained create/update. Invalid id → 400 (`board.ts:242-243`). Missing → 404 (`board.ts:245-246`). |
| Soft-block ordering (before cleanupClone) | **Implemented** | Count gate `board.ts:251-257` **before** `cleanupClone` `board.ts:259-261` and `deleteRepo` `board.ts:266`. Diff confirms insert-only above existing cleanup block. |
| `countCardsByRepo` SQL COUNT | **Implemented** | `board-db.ts:341-352` — `SELECT COUNT(*) AS count FROM cards WHERE repo_id = ?` (not `listCards().length`). |
| AC2 List suitable for UI | **Implemented** | `GET /board/repos` → `{ repos: [...] }` via `repoResponse` fields id/name/remote_url/secret_ref/local_path/created_at/updated_at (`board.ts:87-97`, `133-137`). Empty list valid (map over `listRepos()`). List smoke: `board.test.ts:93-96`. |
| AC3 Editable config; no secret leak | **Implemented** | Modal fields name / remote_url / secret_ref only (`dashboard-page.ts:367-386`); no `local_path` input. Save payload same three fields (`dashboard-page.ts:661-670`). Responses use `secret_ref` name only (`board.ts:87-97`). Non-leak assert: `board.test.ts:89-91` (`secret_ref === "BOARD_TEST_TOKEN"`, body lacks `"fake-token"`). Short test keys: `board.test.ts:19`, `26` (`test-key` / `fake-board-key`). |
| AC4 Projects list + create/open-edit + board link | **Implemented** | Projects pane + New project: `dashboard-page.ts:297-303`. List rows Edit/Delete: `dashboard-page.ts:572-601`. Board header link: `ui.ts:272` `href="/#projects"`. Hash soft-nav: `dashboard-page.ts:549-560`. Test markers: `dashboard.test.ts:76-81`; link assert `ui.test.ts:71`. |
| AC5 Modal create/edit | **Implemented** | `#project-modal` `role="dialog"` (`dashboard-page.ts:367`). Create/edit modes (`623-640`); Cancel closes+resets (`642-645`, `740`); Save POST/PUT then `loadProjects` (`661-697`). Errors show `body.error` on 400/409 (`683-685`). Not full-page forms. |
| AC6 Delete confirm + soft-block UX | **Implemented** | `#project-delete-modal` dialog (`dashboard-page.ts:390-399`); Confirm DELETE (`700-724`); on 409 sets `projectDeleteError` and returns without navigation (`710-712`). API 409 message shape exact: `board.ts:253-255` / `board.test.ts:334-336`. Repo+cards remain: `board.test.ts:338-346`. Empty delete after card removed → 200: `board.test.ts:349-396`. Dedicated dialog (no `window.confirm` in file). |
| AC7 Verify + tests | **Implemented differently** | Feature route/UI tests **green** (board + dashboard + ui: 20/20). `npm run typecheck` ✅, `npm run build` ✅, `npm run scan-secrets` ✅. Full `npm test` **exit 1**: 3 failures in `harness.test.js` (`POST /harness/runs` 404) — **pre-existing** (reproduced with feature sources stashed; still 3 fails). Not caused by 39 diff. Soft-block test does not assert clone FS untouched when blocked (ordering proven in code). Optional `board-db.test.ts` count unit **absent** (plan optional). |
| Docs / status sync | **Implemented** (minor gap) | Human spec `status: shipped` (`.agents/specs/39-board-projects-management.spec.md:7`). `index.PRD` checkbox Done + Done log (`index.PRD:123`, `177`); Next empty. README Projects CRUD (`README.md:56`). AGENTS purpose + Planned shipped (`AGENTS.md:18`, `166`). **Gap:** plan mirror `step-00-…spec.md` still `status: draft` (line 7). |
| No scope creep (OOS) | **Implemented** | No `/board/projects`, no `projects` table (grep clean under `src/`). No ensure-clone UI in Projects pane. Diff blast radius matches appendix file list (+ docs). |

## Additional Features Beyond Original Plan

| Feature / Extra Behavior | Location in Code | Note |
|--------------------------|------------------|------|
| (none material) | — | Implementation matches locked L1–L5 + A8–A17; no dual envelope / soft-delete column / pagination. |

## Gaps and Next Steps

- **AC7 suite-wide:** Full `npm test` remains red due to **pre-existing** harness route failures (`404` on valid `/harness/runs`). Out of scope for 39; do not treat as soft-block/CRUD gap. Track separately if CI requires green suite.
- **Plan mirror status:** Update `.agents/plans/39-board-projects-management/step-00-39-board-projects-management.spec.md` frontmatter `status` to match shipped human spec (docs nit; does not block score ≥7).
- **Optional harden:** Assert blocked DELETE leaves clone tree intact; add `countCardsByRepo` unit in `board-db.test.ts`.

## Fable light audit (`fable.enabled` + `autoAudit`)

**Verdict:** `VERIFIED WITH CAVEATS` (not REFUTED — no score cap under `auditVerdictsBlockShip`)

| Check | Result |
|-------|--------|
| Claims vs `git diff` | Soft-block + `countCardsByRepo` + dashboard modals + board link + tests + docs match expected blast radius (~11 files, +392/−26). |
| Re-run verify | typecheck/build/scan-secrets PASSED; `npm test` FAILED (3 harness — pre-existing). Feature suites PASSED. |
| Weakened checks | None — new asserts tighten 409 message + repo/card retention (`board.test.ts:305-347`). |
| False completion | Caveat only: docs mark 39 shipped while whole-suite `npm test` is red for unrelated harness. |
| Scope creep | None detected in product diff. |
| Unauthorized action | None (no push/deploy; readonly verify). |

## Score rationale

Integer **9/10**. All measurable ACs (CRUD, soft-block-before-cleanup, modal UX, board link, secret non-leak, feature tests, primary docs) have file:line evidence. Deduction (−1) for AC7 whole-suite `npm test` red (pre-existing/OOS) + plan-mirror status nit. Threshold ≥7 → **complete** (autoMode approve).

## Gate (autoMode)

- **score:** 9
- **status:** completed
