---
slug: 39-board-projects-management
step: 7
title: "Testing report — Board projects management (CRUD, soft-block delete, modals)"
status: passed
skipBrowser: true
autoMode: true
reportDate: 2026-07-26
sourcePlan: step-07-39-board-projects-management.testing.plan.md
refinedPlan: step-02-39-board-projects-management.plan.refined.md
sourceSpec: step-00-39-board-projects-management.spec.md
step05: step-05-39-board-projects-management.plan.report.md
---

# Step 7 — Testing Report · 39-board-projects-management

**Verdict:** PASSED  
**Generated:** 2026-07-26  
**Browser:** skipped (`autoMode=true`; no browser-mcp; approved without browser)  
**DB seeds:** exercised via temp SQLite in board / board-db route tests  
**Fixes applied:** none (battery green on first run; no product edits)

## Executive summary

All planned verification commands for this slug passed. Focused feature suite **28/28** green under `npx tsx --test` (board + dashboard + ui + board-db). Full `npm test` = **182 pass / 3 fail**; failures are pre-existing unrelated `Harness API Routes` assertions (404 vs expected 200/202), not blockers for AC39. No `src/` edits required.

## Step 2 — Base build & typecheck

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` (`verification.backendTest`) | **PASSED** | `tsc --noEmit` |
| `npm run build` (`verification.backendBuild`) | **PASSED** | `tsc` → `dist/` |
| `npm run scan-secrets` (`verification.backendFormat`) | **PASSED** | `OK (staged, 0 file(s) checked)` |

## Step 3 — Unit tests (focused feature suite)

| Command | Result | Notes |
|---------|--------|-------|
| `npx tsx --test src/routes/board.test.ts src/routes/dashboard.test.ts src/routes/ui.test.ts src/services/board-db.test.ts` | **PASSED** | **28 pass / 0 fail**, ~949ms |

Suite breakdown:

| Suite | Pass | Fail | Notes |
|-------|------|------|-------|
| Board API Routes | 13 | 0 | Auth, CRUD/secret_ref, soft-block DELETE 409, delete-after-clear 200 |
| Dashboard root UI | 4 | 0 | GET `/` HTML; Projects markers (`btn-project-new`, `project-modal`, `project-delete-modal`); stub slug absent |
| UI routes | 5 | 0 | Deep links + board HTML includes `href="/#projects"` |
| board-db | 3 | 0 | repos/cards + settings seed/persist (no dedicated `countCardsByRepo` unit; covered via board soft-block) |
| board-clone helpers | 2 | 0 | bundled with board-db.test.ts import graph |
| board-secret | 1 | 0 | bundled with board-db.test.ts import graph |

Feature-focused AC coverage:

| AC / case | Result |
|-----------|--------|
| AC1 Auth 401 + CRUD + soft-block 409 | **PASS** (`board.test.ts`) |
| AC1/AC6 DELETE empty → 200 after cards removed | **PASS** (`allows DELETE after referencing cards are removed`) |
| AC2 List fields / CRUD shape | **PASS** (`CRUD repos without exposing secrets`) |
| AC3 `secret_ref` only; no token leak | **PASS** (`CRUD repos without exposing secrets`) |
| AC4/AC5 Projects pane create/edit modal markers; stub gone | **PASS** (`dashboard.test.ts`) |
| AC4 Board link `/#projects` | **PASS** (`ui.test.ts`) |
| AC6 Delete confirm affordance (`project-delete-modal`) | **PASS** (`dashboard.test.ts`) |
| AC6 Soft-block message shape | **PASS** (`Cannot delete repository: 1 card(s) still reference it`) |
| AC7 typecheck/build/scan-secrets/feature tests | **PASS** |

**Coverage gap (accepted):** Browser modal open/save/cancel and 409 UI surface text not exercised (skip-browser / autoMode). Static HTML markers + API route tests cover AC7 as planned. No dedicated `countCardsByRepo` unit in `board-db.test.ts` (behavior covered via DELETE soft-block route tests).

### Full suite (documented, non-blocking)

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | **182 pass / 3 fail** | Failures only in `Harness API Routes` (`dist/routes/harness.test.js`) |

Unrelated failures (pre-existing; out of AC39 scope):

| Test | Actual | Expected |
|------|--------|----------|
| `POST /harness/runs` accepts valid spec → 202 (AC4) | status **404** | **200** (assertion in test; route may return 202) |
| `POST /harness/runs` resolves repo name under `REPOS_ROOT` | `TypeError` reading `repoPath` of undefined | resolved path |
| `POST /harness/runs/:runId/resume` → 202 (AC4) | status **404** | **202** |

These do **not** touch board/dashboard/ui/board-db surfaces for this slug.

## Step 4 — DB seeds

**Verified** via board route tests (temp DB): create repo + card for soft-block; delete card then empty DELETE. board-db settings seed/persist also green. No shared production DB mutation. Soft-block ordering (count before cleanup) inferred from 409 with cards remaining; clone cleanup not invoked on blocked path per route design (covered by soft-block assertions).

## Step 5 — API / integration contracts

Covered by focused route tests:

| Contract | Verdict |
|----------|---------|
| Unauth `/board/repos` → 401 | **PASS** |
| CRUD repos; `secret_ref` name only | **PASS** |
| DELETE with cards → 409 + locked error | **PASS** |
| DELETE after cards cleared → 200 `{ ok: true }` | **PASS** |
| `GET /` Projects modal markers; no stub slug | **PASS** |
| `GET /ui/board` → 200 + `/#projects` | **PASS** |

## Step 6 — UI / E2E / browser

**Skipped** — `autoMode=true` / no browser-mcp. Accessibility/contrast on form errors: **N/A** (no browser pass). Approved without browser per orch instructions.

## Feature-quality AC checklist

| ID | Observable | Verdict |
|----|------------|---------|
| AC1 | CRUD + 401 + soft-block 409 | **PASS** |
| AC2 | List suitable for UI | **PASS** |
| AC3 | Editable config; no secret leak | **PASS** |
| AC4 | Projects list affordances + board link | **PASS** |
| AC5 | Modal create/edit markers | **PASS** |
| AC6 | Delete confirm + soft-block | **PASS** |
| AC7 | Build + feature tests | **PASS** |

## Defect thresholds

| Metric | Threshold | Actual |
|--------|-----------|--------|
| typecheck | exit 0 | exit 0 |
| build | exit 0 | exit 0 |
| scan-secrets | exit 0 | OK (0 staged) |
| focused feature tests | 0 fail | 28/28 |
| Critical AC gaps | none | none |
| Full suite harness fails | document only | 3 unrelated |
| Browser | N/A skipped | skipped-auto |

## Fixes / loops

| Loop | Outcome |
|------|---------|
| 1 (initial battery) | All slug-required checks green — no fix loop needed |

## Recommendation

- [x] **PASS → Step 8** (ship / prepare board)
- [ ] Fail / remediation

**Note for ship:** If CI runs full `npm test`, the 3 harness route failures will still red-check until fixed OOS. Slug AC39 verification is complete.

**Learning:** N/A (standard testing pass; MEMORY short-key stubs already applied; harness 404 failures remain known OOS).
