---
slug: 40-main-page-dashboard
step: 6
base: HEAD (working tree vs committed + untracked feature files)
reviewedAt: "2026-07-26T10:06:00Z"
reviewer: ws-code-review (Step 6)
autoMode: true
---

# Step 6 — Code Review: 40-main-page-dashboard

**Scope:** Root dashboard shell + SQLite settings API vs refined plan.  
**In-scope files:** `src/index.ts`, `src/services/board-db.ts`, `src/services/board-db.test.ts`, `src/routes/settings.ts`, `src/routes/settings.test.ts`, `src/routes/dashboard-page.ts`, `src/routes/dashboard.test.ts`.  
**Excluded:** `dist/`, `node_modules/`, OOS `src/` (none observed), plan artifacts except this report.  
**MEMORY applied:** Packaging status doc sync → Warning (not Nit); secrets short keys; no OOS scope.

## Diff inventory

| Path | Status |
|------|--------|
| `src/index.ts` | modified — `GET /` HTML + `/settings` auth mount |
| `src/services/board-db.ts` | modified — `app_settings` migration, seed, list/get/set |
| `src/services/board-db.test.ts` | modified — seed + persist reopen |
| `src/routes/settings.ts` | untracked (new) |
| `src/routes/settings.test.ts` | untracked (new) |
| `src/routes/dashboard-page.ts` | untracked (new) |
| `src/routes/dashboard.test.ts` | untracked (new) |

No OOS `src/` churn (board execution, `ui.ts`, auth middleware semantics untouched).

## AC cross-check

| AC | Verdict | Evidence |
|----|---------|----------|
| AC1 `GET /` HTML + login | **Pass** | `index.ts` `app.get("/", … c.html(…))`; login gate `#login-gate` / `#login-api-key`; test `dashboard.test.ts` |
| AC2 login / fail / restore | **Pass** | Probe `GET /settings`; non-leaky `"Invalid or missing API key"`; `.authed` CSS gate; sessionStorage `cursor-server-api-key`; settings 401/200 tests |
| AC3 left nav + main pane | **Pass** | `aside.nav` + `#main-pane`; hash soft-nav `#dashboard`/`#projects`/`#config` |
| AC4 menu + Kanban navigate | **Pass** | Four labels; Kanban `<a href="/ui/board">`; `#kanban` → `/ui/board`; no iframe; `/ui/board` regression test |
| AC5 Projects stub | **Pass** | Read-only `/board/repos` list + 39 placeholder; no CRUD controls |
| AC6 settings KV + SQLite | **Pass** | Migration + five seeded keys; GET/PUT allowlist + enums; persist reopen test |
| AC7 anti-slop + narrow | **Pass** | Board tokens (`--accent #3d8bfd`); no purple-gradient; `@media (max-width: 720px)` collapse |
| AC8 tests / no cloud | **Pass** | Route + board-db tests; short `"test-key"` / `"fake-board-key"`; no SDK in new tests |

## Triage → investigate (retained)

| Hypothesis | Result |
|------------|--------|
| Auth leak via public HTML shell | **Discarded** — plan A5: public HTML + client gate; protected data only via authed APIs |
| Settings persist API keys / secrets | **Discarded** — allowlist + per-key enums; unknown key `400`; no secret columns |
| SQL injection on settings | **Discarded** — parameterized `?` binds on insert/select/upsert |
| XSS via projects `innerHTML` | **Discarded** — `escapeHtml` on `name` / `remote_url`; static loading strings |
| Route business-logic bloat | **Discarded** — zod at route (board pattern); persistence on `BoardDatabase` |
| OOS scope creep | **Discarded** — only planned files; Projects CRUD / iframe / per-tenant settings absent |
| README/AGENTS lag after land | **Retained → Warning** (MEMORY packaging status doc sync) |

## Critical

_No feedback_

## Warning

### W1 — README / AGENTS lag behind landed root dashboard + settings API

- **path:** `README.md` (Status / API surface ~L55–73); `AGENTS.md` (Architecture tree ~L31–44; primary use cases ~L12–17; Planned “shipped recently” ~L162)
- **score:** 7/10
- **Evidence Read:** Feature code mounts `GET /` → HTML shell and protected `GET`/`PUT /settings` (`src/index.ts:40`, `81–83`). README Status lists `/ui/board`, `/ui/prompt`, `/ui/spec-editor`, etc., but **omits** `GET /` and `/settings`. AGENTS architecture tree still ends at `ui.ts` / board routes with no `dashboard-page.ts` / `settings.ts`; primary use cases omit root ops console. `rg` over README+AGENTS for `/settings` / root dashboard → no hits.
- **Failure Scenario:** Operators and later agents treat `http://host:3000/` as empty/API-only and re-open or skip the landed shell; settings API stays undocumented while live on the host.
- **Missing Protection:** Docs not updated in the same delivery turn as the land (MEMORY: Packaging status doc sync → Warning, not Nit). Refined plan deferred docs to ship/`ws-sync-spec`, but AGENTS.md itself requires README/AGENTS/`index.PRD` updates when shipped code changes.
- **Discards:** Not Critical (runtime ACs hold). Not Nit — MEMORY elevates this class. Not OOS — status sync is an established Step 6 fix target. Not a false “still unfinished” contradiction in Planned areas (40 not listed as a gap); severity is **shipped-surface omission / lag**.
- **Sibling occurrences:** `.agents/specs/index.PRD` feature map / Done log still omit `40` (expected until ship sync — fold into same fix pass if touching docs). Spec frontmatter still `status: draft`.
- **suggestion:**
  ```markdown
  # README Status — add:
  - `GET /` — ops dashboard shell (login gate, left nav, config)
  - `GET`/`PUT /settings` — host-level preference store (API key auth)

  # AGENTS.md — add to Architecture + use cases / shipped recently:
  - dashboard-page.ts / settings.ts; GET / root UI; app_settings via board-db
  ```

## Nit / Suggestion

### N1 — No explicit test for settings value `max(256)` rejection

- **path:** `src/routes/settings.test.ts`
- **score:** 3/10
- **Notes:** Zod `.max(256)` exists; unknown key + invalid enum covered. Optional assert oversized string → 400.
- **suggestion:** One PUT with a 257-char value for an allowlisted key expecting 400.

### N2 — `setSettings` service trusts route for enum/length

- **path:** `src/services/board-db.ts` (`setSettings`)
- **score:** 2/10
- **Notes:** Service allowlist-skips unknown keys then writes; enum/max enforced only in `settings.ts`. Matches thin-route + board zod pattern; defense-in-depth optional.
- **suggestion:** Leave as-is unless service is called outside the route.

### N3 — `escapeHtml` omits single-quote escape

- **path:** `src/routes/dashboard-page.ts` (~L499–505)
- **score:** 2/10
- **Notes:** Values interpolated as HTML text nodes inside `<li>`, not attributes; `<`/`>`/`&`/`"` covered. Low residual risk.
- **suggestion:** Add `.replace(/'/g, "&#39;")` if reused for attributes later.

## Pattern sweep (MEMORY)

| Pattern | Result |
|---------|--------|
| Packaging status doc sync (Warning bar) | **Confirmed** → W1 |
| scan-secrets short / fake test keys | **Protected** — `"test-key"`, `"fake-board-key"` |
| Docs implement OOS scope creep | **Clean** — no drive-by unrelated `src/` |
| Promise.race timer leak / Hermes circular register | **N/A** |
| Review Patterns section | None defined in MEMORY |

## Invariants checklist

| Invariant | Result |
|-----------|--------|
| `secretsFromEnvOnly` | **Pass** — no API keys in `app_settings`; secrets stay env / `secret_ref` |
| `thinRoutesNoBusinessLogic` | **Pass** — persistence in `board-db`; zod boundary OK |
| `noHardcodedRepoAbsolutePaths` | **Pass** — `BOARD_DB_PATH` via config / tests use temp paths |
| `localSdkRuntimeOnly` | **Pass** — no SDK usage in feature |
| Client auth / no new secret store | **Pass** — `sessionStorage` KEY_STORAGE reuse only |
| Projects stub ≠ CRUD (no OOS into 39) | **Pass** |
| Kanban navigate (no iframe) | **Pass** |
| Deep links `/ui/*` | **Pass** — `ui.ts` unmodified; regression test |

## Security focus (requested)

| Concern | Verdict |
|---------|---------|
| Auth leaks | Public HTML intentional; data behind `authMiddleware`; login error non-leaky |
| Secret persistence | Allowlist + enums; test rejects `secret_api_key` |
| SQL injection | Parameterized binds |
| XSS in HTML shell | Server template static (no user interp); client escapes dynamic repo fields |
| Anti-slop | Board palette; blue accent; no purple/glow/hero |

## Fable / fraud (light)

| Fraud | Result |
|-------|--------|
| Weakened checks | None — AC→tests mapped; short keys |
| False completion | None for code ACs; docs lag acknowledged as W1 |
| Scope creep | None — stub Projects; no iframe; no per-tenant settings |
| Unauthorized action | None — no commit/push this step |

**Verdict:** VERIFIED WITH CAVEATS (docs sync W1).

## Praise

- Parameterized settings SQL + seed-if-missing matches board migration style.
- Login probe reuses protected `/settings`; UI error string does not echo middleware.
- Projects list escapes untrusted repo names/URLs before `innerHTML`.
- Anti-slop CSS aligned with existing board tokens; narrow nav collapse present.
- Test stubs respect scan-secrets length/PLACEHOLDER guidance.

## Apply fixes?

**YES** (workflow `autoMode` + Warning present → dispatch `ws-implement-tasks` `mode=fix`).

Fix **W1** only (README Status + AGENTS architecture/use-cases/shipped-recently; optionally index.PRD row when convenient). Do **not** expand into Projects CRUD, per-tenant settings, or `src/` behavior changes for N1–N3 unless trivial while touching docs.

No commits this step. Do not edit `src/` in the review artifact pass (fix substep owns edits).
