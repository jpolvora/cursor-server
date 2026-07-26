---
slug: 40-main-page-dashboard
step: 6-fix
fixedAt: "2026-07-26T10:10:00Z"
mode: fix
---

# Step 6 Fix Report — 40-main-page-dashboard

## Scope

Docs-only sync for review Warning **W1** (README / AGENTS lag behind landed `GET /` + `/settings`). Nits N1–N3 deferred. No `src/` changes. Spec `39` not implemented.

## Fixed

### W1 — README / AGENTS lag behind root dashboard + settings API

| File | Change |
|------|--------|
| `README.md` | Status list: `GET /` ops dashboard shell; `GET`/`PUT /settings` host prefs. Roadmap Ops UI notes `40` landed; **Next** = `39` (not claimed done). |
| `AGENTS.md` | Use case #8 root ops dashboard; architecture tree adds `dashboard-page.ts`, `settings.ts`, `board-db.ts` / `app_settings`; shipped-recently includes `40`; explicit Next: `39`. |
| `.agents/specs/index.PRD` | Next specs: `40` in progress (implemented, ship sync pending); `39` planned. |

## Deferred (nits)

| Id | Reason |
|----|--------|
| N1 | Settings `max(256)` rejection test — optional; not docs W1 |
| N2 | `setSettings` enum defense-in-depth — leave as-is per review |
| N3 | `escapeHtml` single-quote — low residual; values are text nodes |

## Verification

- `npm run typecheck` — pass (docs-only; no TS impact)

## Out of scope (honored)

- No Projects CRUD (`39`)
- No commit
- No `src/` behavior or test changes for N1–N3
