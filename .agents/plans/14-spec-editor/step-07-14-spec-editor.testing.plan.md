---
slug: 14-spec-editor
step: 7
title: "Testing plan — Spec Editor & Interactive Environment"
status: planned
skipBrowser: true
reportDate: 2026-07-25
sourcePlan: step-01-14-spec-editor.plan.md
sourceSpec: step-00-14-spec-editor.spec.md
anchor: uswf/14-spec-editor-20260725T230627Z/before-step-7
---

# Step 7 — Testing Plan · 14-spec-editor

## Scope

Backend + route unit battery for the served Spec Editor MVP. No React/Vite frontend; UI is Hono-served HTML. Browser automation **skipped** (`autoMode=true` → no browser-mcp).

Touched / focus surface:
- `src/routes/ui.ts` + `ui.test.ts`
- `src/routes/specs.ts` + `specs.test.ts`
- `src/routes/harness.ts` + `harness.test.ts`
- `src/services/spec-schema.ts` + `spec-schema.test.ts`
- `src/index.ts` (mount wiring)

## Verification commands (config + orch)

| Source | Command | Role |
|--------|---------|------|
| `verification.backendTest` | `npm run typecheck` | `tsc --noEmit` |
| `verification.backendBuild` | `npm run build` | Compile → `dist/` |
| `verification.backendFormat` | `npm run scan-secrets` | Leak scan |
| Focused unit (post-build) | `node --test --test-force-exit dist/routes/ui.test.js dist/routes/specs.test.js dist/routes/harness.test.js dist/services/spec-schema.test.js` | AC-mapped focused suite |
| Optional HTTP smoke | Start server briefly → `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ui/spec-editor` | Live HTML 200; skip if cannot start |

**Note:** Prefer `--test-force-exit` to avoid hang on open handles (scheduler / prior hung `npm test` sessions). MEMORY: Promise.race timeout `clearTimeout` in `finally` if harness-runner tests included.

## Targets / credentials / DB

| Area | Status |
|------|--------|
| API host | `http://localhost:3000` (optional smoke only) |
| Auth | UI public; API routes use existing `authMiddleware` when `SERVER_API_KEY` set — unit tests mock/open as today |
| DB seeds / rollback | **N/A** (no database) |
| Browser / UI / i18n | **Skipped** (`skip-browser` / autoMode) |

## Unit & coverage gaps vs changed files

| AC | Observable case | Expected coverage |
|----|-----------------|-------------------|
| AC1 | `GET /ui/spec-editor` → 200 HTML with editor markers | `ui.test.ts` |
| AC1 | List/open/author surfaces present in HTML/JS | `ui.test.ts` markers |
| AC2 | `POST /specs/validate` valid/invalid feedback | `specs.test.ts` |
| AC3 | PUT writes under `.agents/specs/`; traversal rejected | `specs.test.ts` + `spec-schema.test.ts` |
| AC3 | Harness resolves repo name → 202 `runId` | `harness.test.ts` |
| — | Safe filename / round-trip IO | `spec-schema.test.ts` |

## API contracts (non-browser)

| Check | Expected |
|-------|----------|
| `GET /ui/spec-editor` (unit or curl) | 200, `text/html`, editor shell |
| `POST /specs/validate` | 200 `{ valid, errors }` |
| `GET/PUT /repos/:repo/specs/:file` | 200 / 400 on traversal |
| `POST /harness/runs` with `{ repo }` name | 202 + `runId`; unknown repo 400 |

## RBAC / tenancy

N/A beyond existing API-key middleware. UI route must remain public (no auth required for GET shell).

## Integration / E2E

| Path | Plan |
|------|------|
| Cross-service | In-process Hono route tests (no live SDK required for UI paths) |
| Browser E2E / debounce UX | **Skipped** (autoMode / no browser-mcp) |
| Live HTTP smoke | Optional curl if server startable; else note skip |

## Feature-quality AC checklist (observable)

| ID | Observable outcome | Pass if |
|----|--------------------|---------|
| AC1 | Editor HTML served with repo/list/textarea controls | Unit or curl 200 + body markers |
| AC2 | Validate endpoint returns structured errors | Unit assertions |
| AC3 | Save path confined; Save & Run path yields runId | Unit assertions on PUT + harness |

## Defect thresholds (pass/fail)

| Metric | Pass | Fail |
|--------|------|------|
| `npm run typecheck` | exit 0 | non-zero |
| `npm run build` | exit 0 | non-zero |
| Focused unit suite | 0 fail; process exits | any fail or hang |
| `npm run scan-secrets` | exit 0 | non-zero |
| Critical AC gaps | none | missing AC1–AC3 coverage |
| Optional HTTP smoke | 200 or explicitly skipped | unexpected non-200 when attempted |
| Browser / a11y | N/A (skipped) | — |

**Step pass:** typecheck + build + scan-secrets + focused tests green; AC checklist covered. Failures → surgical fix (max 3 loops), revalidate; do not commit.
