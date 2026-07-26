---
slug: 39-board-projects-management
step: 7
title: "Testing plan — Board projects management (CRUD, soft-block delete, modals)"
status: planned
skipBrowser: true
autoMode: true
reportDate: 2026-07-26
sourcePlan: step-02-39-board-projects-management.plan.refined.md
sourceSpec: step-00-39-board-projects-management.spec.md
step05: step-05-39-board-projects-management.plan.report.md
---

# Step 7 — Testing Plan · 39-board-projects-management

## Scope

Backend + route unit battery for Projects alias UX over board `repos` / `/board/repos`: soft-block DELETE when cards exist, dashboard modal CRUD markers, board header link to `/#projects`. No React/Vite frontend; UI is Hono-served HTML. Browser automation **skipped** (`autoMode=true` → no browser-mcp; approve without browser).

Touched / focus surface:

- `src/services/board-db.ts` (+ optional `board-db.test.ts` for `countCardsByRepo`)
- `src/routes/board.ts` + `board.test.ts` (soft-block 409, CRUD regression, secret_ref non-leak, 401)
- `src/routes/dashboard-page.ts` + `dashboard.test.ts` (Projects pane modals / markers; no stub slug)
- `src/routes/ui.ts` + `ui.test.ts` (`/#projects` discoverability link)

## Verification commands (config + orch)

| Source | Command | Role |
|--------|---------|------|
| `verification.backendTest` | `npm run typecheck` | `tsc --noEmit` |
| `verification.backendBuild` | `npm run build` | Compile → `dist/` |
| `verification.backendFormat` | `npm run scan-secrets` | Leak scan (empty staged OK) |
| Focused feature suite | `npx tsx --test src/routes/board.test.ts src/routes/dashboard.test.ts src/routes/ui.test.ts` (+ `src/services/board-db.test.ts` if relevant) | AC-mapped focused suite |
| Optional full harness | `npm test` | Note pre-existing unrelated failures separately (not blockers for this slug) |

**MEMORY:** scan-secrets CURSOR_API_KEY stubs must stay short (`"test-key"` / `"fake-board-key"`). No long descriptive fake keys.

## Targets / credentials / DB

| Area | Status |
|------|--------|
| API host | In-process Hono route tests (no live server required) |
| Auth | `/board/*` under `authMiddleware`; tests use short stub keys; dashboard HTML public with client gate |
| DB seeds / rollback | Temp SQLite via board route / board-db tests; create repo + card for soft-block; cleanup per test |
| Browser / UI / i18n | **Skipped** (`skip-browser` / autoMode); English markers only |

## Unit & coverage gaps vs changed files

| AC | Observable case | Expected coverage |
|----|-----------------|-------------------|
| AC1 | Authenticated CRUD; 400/404/409; unauth 401 | `board.test.ts` |
| AC1/AC6 | DELETE with cards → 409 + locked error shape; empty DELETE → 200; cards + repo remain when blocked | `board.test.ts` soft-block cases |
| AC2 | `GET /board/repos` list fields; empty OK | `board.test.ts` |
| AC3 | `secret_ref` name only; no resolved token in body | `board.test.ts` |
| AC4/AC5 | Dashboard Projects pane: `btn-project-new`, `project-modal`; stub slug gone | `dashboard.test.ts` |
| AC4 | Board HTML links to `/#projects` | `ui.test.ts` |
| AC6 | Delete confirm affordance in HTML (`project-delete-modal` or equivalent) | `dashboard.test.ts` |
| AC7 | typecheck / build / scan-secrets / feature tests; no real remotes | this battery |

## API contracts (non-browser)

| Check | Expected |
|-------|----------|
| `GET /board/repos` without key | 401 |
| `POST/GET/PUT /board/repos` happy path | 200/201; list fields present |
| `DELETE /board/repos/:id` with cards | 409 `{ error: "Cannot delete repository: N card(s) still reference it" }` |
| `DELETE /board/repos/:id` empty | 200 `{ ok: true }` |
| Responses | `secret_ref` env name only; no token material |
| `GET /` (unit) | Projects modal markers; no `39-board-projects-management` stub |
| `GET /ui/board` | 200 + `href="/#projects"` |

## RBAC / tenancy

Reuse existing board API-key auth. No new roles. Tenant `checkRepoTenantAccess` unchanged; soft-block does not bypass auth. Soft-block check runs **before** `cleanupClone`.

## Integration / E2E

| Path | Plan |
|------|------|
| Cross-service | In-process Hono + temp SQLite (board routes / board-db) |
| Browser E2E / visual QA | **Skipped** (autoMode / no browser-mcp) |
| Live HTTP smoke | Optional; not required for pass when unit coverage green |

## Feature-quality AC checklist (observable)

| ID | Observable outcome | Pass if |
|----|--------------------|---------|
| AC1 | CRUD + 401 + soft-block 409 | Unit status + body shape |
| AC2 | List suitable for UI | Unit list fields / empty OK |
| AC3 | Editable config; no secret leak | Unit `secret_ref` only |
| AC4 | Projects list + create/edit affordances; board link | Dashboard + ui HTML markers |
| AC5 | Modal create/edit (not full-page) | Modal ids in HTML |
| AC6 | Delete confirm + soft-block | Confirm markers + 409 unit |
| AC7 | Verify battery green | typecheck + build + scan-secrets + feature tests |

## Defect thresholds (pass/fail)

| Metric | Pass | Fail |
|--------|------|------|
| `npm run typecheck` | exit 0 | non-zero |
| `npm run build` | exit 0 | non-zero |
| `npm run scan-secrets` | exit 0 | non-zero |
| Focused feature suite | 0 fail | any fail in board/dashboard/ui (or board-db count helper) |
| Critical AC gaps | none | missing AC1–AC7 coverage for this slug |
| Full `npm test` harness failures | Document only if unrelated | Block only if failure is in this slug's files |
| Browser / a11y | N/A (skipped) | — |

**Step pass:** typecheck + build + scan-secrets + focused feature tests green; AC checklist covered by units. Unrelated full-suite harness failures documented, not blockers. Product fixes only if 39-scope tests fail — then report clearly; do not commit.
