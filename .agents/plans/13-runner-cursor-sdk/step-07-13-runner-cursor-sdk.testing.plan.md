---
slug: 13-runner-cursor-sdk
step: 7
title: "Testing plan — Cursor SDK Runner Adapter"
status: planned
skipBrowser: true
reportDate: 2026-07-25
sourcePlan: step-02-13-runner-cursor-sdk.plan.refined.md
sourceSpec: step-00-13-runner-cursor-sdk.spec.md
---

# Step 7 — Testing Plan · 13-runner-cursor-sdk

## Scope

Backend-only unit/integration battery for `CursorSdkRunner` (`harness-runner.ts` + `harness-runner.test.ts`). No frontend, no DB, no browser (auto-gate: Approve and run without browser).

Touched surface:
- `src/services/harness-runner.ts`
- `src/services/harness-runner.test.ts`

## Verification commands (config + orch)

| Source | Command | Role |
|--------|---------|------|
| `verification.backendBuild` | `npm run build` | Compile TypeScript → `dist/` |
| `verification.backendTest` | `npm run typecheck` | `tsc --noEmit` |
| Unit suite (prefer force-exit) | `npm run build && node --test --test-force-exit "dist/**/*.test.js"` | Full unit battery; avoid hang on pre-existing scheduler cron open handles |
| Secrets | `npm run scan-secrets` | Leak scan before PR |

**Note:** Plain `npm run test` may hang on scheduler cron handles; prefer `--test-force-exit` as above.

## Targets / credentials / DB

| Area | Status |
|------|--------|
| API host | N/A this PR (no route changes); default `http://localhost:3000` if smoke needed later |
| Auth / Bearer JWT | N/A (no auth change) |
| DB seeds / rollback | N/A (no database) |
| Browser / UI / i18n | **Skipped** (no frontend) |

## Unit & coverage gaps vs changed files

Plan §5 / AC mapping — all expected in `harness-runner.test.ts`:

| AC | Case | Expected test |
|----|------|---------------|
| AC1 | Registry has `cursor-sdk`; default `cursor-local` | RunnerRegistry |
| AC1 | Stage default agents (spec/implement/build/test/review) | CursorSdkRunner + helpers |
| AC1 | `options.agent` override | CursorSdkRunner |
| AC1 | Model pass-through | CursorSdkRunner |
| AC2 | `finished` → success + artifacts + durationMs | CursorSdkRunner |
| AC2 | SDK `error`/`cancelled` → `failed` | CursorSdkRunner |
| AC3 | Throw → `error` (no throw out) | CursorSdkRunner |
| AC3 | Timeout → `error` + floating catch | CursorSdkRunner |
| AC3 | Unsupported `deploy` → `error` | CursorSdkRunner |
| — | healthCheck | CursorSdkRunner |
| — | list length with 2 built-ins | RunnerRegistry |

**MEMORY applied:** Promise.race timeout `clearTimeout` in `finally` (Medium) — timeout tests must complete without hanging the suite.

## API contracts

No HTTP surface changed this PR. Contract checks: **N/A / skipped** (orchestrator already selects runner via `runnerId`; no new routes).

Optional smoke (only if server running; not required to pass Step 7):
- `GET /health` → 200

## RBAC / tenancy

N/A — single-host, no auth/tenancy change.

## Integration / E2E

| Path | Plan |
|------|------|
| Cross-service | N/A (in-process unit mocks of `runTask`) |
| UI routes / translations | **Skipped** (`skip-browser`) |
| Live SDK run | Out of scope (mocked `runTaskFn`; no `CURSOR_API_KEY` required) |

## Feature-quality AC checklist (observable)

| ID | Observable outcome | Pass if |
|----|--------------------|---------|
| AC1 | Stage role + wrapped prompt + model reach `runTaskFn` | Unit assertions on mock calls |
| AC2 | `StageOutput` has `stage`, `status`, `durationMs`, `logs`, optional `artifacts`/`rawResult` | Unit assertions |
| AC3 | Exceptions/timeouts return `error`/`failed`, never throw from `executeStage` | Unit assertions; suite exits clean |

## Defect thresholds (pass/fail)

| Metric | Pass | Fail |
|--------|------|------|
| `npm run build` | exit 0 | non-zero |
| `npm run typecheck` | exit 0 | non-zero |
| Unit suite | 0 fail; process exits | any fail or hang |
| `npm run scan-secrets` | exit 0 | non-zero |
| Critical AC gaps | none | missing AC1–AC3 coverage |
| Browser / a11y | N/A (skipped) | — |

**Step pass:** all commands green + AC checklist covered. Failures → surgical fix via `ws-implement-tasks` mode=fix, then revalidate.
