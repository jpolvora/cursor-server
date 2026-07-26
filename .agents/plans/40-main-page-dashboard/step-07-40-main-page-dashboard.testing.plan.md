---
slug: 40-main-page-dashboard
step: 7
title: "Testing plan — Main page dashboard shell"
status: planned
skipBrowser: true
autoMode: true
reportDate: 2026-07-26
sourcePlan: step-02-40-main-page-dashboard.plan.refined.md
sourceSpec: step-00-40-main-page-dashboard.spec.md
step05: step-05-40-main-page-dashboard.plan.report.md
step06: step-06-40-main-page-dashboard.review.md
---

# Step 7 — Testing Plan · 40-main-page-dashboard

## Scope

Backend + route unit battery for root dashboard shell, settings API, SQLite `app_settings` seed/persist, and `/ui/*` deep-link regression. No React/Vite frontend; UI is Hono-served HTML. Browser automation **skipped** (`autoMode=true` → no browser-mcp; approve without browser).

Touched / focus surface:

- `src/routes/dashboard-page.ts` + `dashboard.test.ts`
- `src/routes/settings.ts` + `settings.test.ts`
- `src/services/board-db.ts` + `board-db.test.ts` (seed + persist)
- `src/routes/ui.ts` + `ui.test.ts` (deep-link regression only; file unchanged)
- `src/index.ts` (`GET /` mount + `/settings` auth)

## Verification commands (config + orch)

| Source | Command | Role |
|--------|---------|------|
| `verification.backendTest` | `npm run typecheck` | `tsc --noEmit` |
| `verification.backendBuild` | `npm run build` | Compile → `dist/` |
| `verification.backendFormat` | `npm run scan-secrets` | Leak scan |
| Focused feature suite | `node --test --import tsx src/routes/dashboard.test.ts src/routes/settings.test.ts src/services/board-db.test.ts src/routes/ui.test.ts` | AC-mapped focused suite |
| Optional full harness | `npm test` | Note pre-existing unrelated failures separately (not blockers for this slug) |

**MEMORY:** scan-secrets CURSOR_API_KEY stubs must stay short (`"test-key"` / `"fake-board-key"`). No long descriptive fake keys.

## Targets / credentials / DB

| Area | Status |
|------|--------|
| API host | In-process Hono route tests (no live server required) |
| Auth | Settings routes use `authMiddleware`; tests use short stub keys; `GET /` HTML is public with client gate |
| DB seeds / rollback | Temp SQLite via board-db tests; verify 5 default keys seed + persist across reopen |
| Browser / UI / i18n | **Skipped** (`skip-browser` / autoMode) |

## Unit & coverage gaps vs changed files

| AC | Observable case | Expected coverage |
|----|-----------------|-------------------|
| AC1 | `GET /` → 200 HTML with login markers | `dashboard.test.ts` |
| AC2 | Settings 401 without key; 200 with valid key; login error markers | `settings.test.ts` + `dashboard.test.ts` |
| AC3 | `#main-pane`, left nav, `data-view` soft-nav markers | `dashboard.test.ts` |
| AC4 | Menu labels + Kanban `/ui/board` link; `/ui/*` deep links still 200 | `dashboard.test.ts` + `ui.test.ts` |
| AC5 | Projects stub placeholder text (not full 39 CRUD) | `dashboard.test.ts` |
| AC6 | Five default settings seeded; GET/PUT allowlist; persist reopen | `board-db.test.ts` + `settings.test.ts` |
| AC7 | Board CSS tokens / no purple-gradient markers (static) | `dashboard.test.ts` |
| AC8 | typecheck + build + feature tests; no Cursor cloud in CI | this battery |

## API contracts (non-browser)

| Check | Expected |
|-------|----------|
| `GET /` (unit) | 200, `text/html`, login gate markers |
| `GET /settings` without key | 401 |
| `GET /settings` with valid key | 200 + seeded defaults |
| `PUT /settings` allowlisted keys | 200; unknown key 400; enum reject 400 |
| `GET /ui/board`, `/ui/prompt`, `/ui/spec-editor` | 200 HTML (regression) |

## RBAC / tenancy

Settings under `authMiddleware`. Public HTML shell must not expose protected settings values without a valid API key. No new tenant ACL surface in this slug.

## Integration / E2E

| Path | Plan |
|------|------|
| Cross-service | In-process Hono + temp SQLite (board-db) |
| Browser E2E / visual QA | **Skipped** (autoMode / no browser-mcp) |
| Live HTTP smoke | Optional; not required for pass when unit coverage green |

## Feature-quality AC checklist (observable)

| ID | Observable outcome | Pass if |
|----|--------------------|---------|
| AC1 | Root HTML + login gate | Unit 200 + body markers |
| AC2 | Auth fail/success contracts | Unit 401/200 + error string non-leaky |
| AC3–AC4 | Shell chrome + menu + Kanban navigate | Unit markers + ui deep links |
| AC5 | Projects stub documented | Stub text asserted |
| AC6 | KV seed + persist | board-db + settings tests |
| AC7 | Anti-slop tokens (static) | CSS/marker asserts; no screenshot |
| AC8 | Build battery green | typecheck + build + feature tests |

## Defect thresholds (pass/fail)

| Metric | Pass | Fail |
|--------|------|------|
| `npm run typecheck` | exit 0 | non-zero |
| `npm run build` | exit 0 | non-zero |
| `npm run scan-secrets` | exit 0 | non-zero |
| Focused feature suite | 0 fail | any fail in dashboard/settings/board-db/ui |
| Critical AC gaps | none | missing AC1–AC8 coverage for this slug |
| Full `npm test` harness failures | Document only if unrelated | Block only if failure is in this slug's files |
| Browser / a11y | N/A (skipped) | — |

**Step pass:** typecheck + build + scan-secrets + focused feature tests green; AC checklist covered by units. Unrelated full-suite harness failures documented, not blockers. Failures in our code → tiny surgical fix + re-run (max loops); do not commit.
