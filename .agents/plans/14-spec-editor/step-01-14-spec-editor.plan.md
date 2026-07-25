---
slug: 14-spec-editor
title: "Served Spec Editor & Interactive Environment"
status: "plan to be refined"
complexity: standard
---

## 0. Summary & Business Rules

**Objective:** Serve a hosted web UI at `GET /ui/spec-editor` so authors can browse, edit, and author `.spec.md` files; validate live via existing `POST /specs/validate`; and **Save & Run** by writing to `{REPOS_ROOT}/{repo}/.agents/specs/` then dispatching `POST /harness/runs`.

**Business rules:**
- Reuse `validateSpecPayload` / `listRepoSpecs` / harness APIs; do not reinvent schema or stage orchestration.
- UI is static HTML/JS (or light Hono HTML response). No React/Vite; `config.stack.frontend.framework` stays `none`.
- UI never calls `@cursor/sdk`; only HTTP to existing/new thin APIs.
- Spec description mentions AC builder, dependency graph, stage config UI; **ACs do not**. MVP is Markdown editor + validation feedback + list/open + Save & Run.

**Security mitigations:**
- Filename/path confinement under `{repo}/.agents/specs/` (no path traversal; basename allowlist).
- Repo resolution via `validateRepoPath(REPOS_ROOT, repo)` only.
- No secrets in UI source or responses; optional `SERVER_API_KEY` sent by browser from user-entered field (sessionStorage), never hardcoded.
- `/ui/*` may stay unauthenticated (read-only shell); `/specs`, `/repos`, `/harness` keep existing `authMiddleware`.

---

## 1. Definition of Ready & Scope

### Resolved assumptions (from codebase)
1. `POST /specs/validate` and `GET /repos/:repo/specs` exist (`src/routes/specs.ts`); no write or single-file read yet.
2. `POST /harness/runs` exists but treats `repo` as a filesystem path (`rawRepoPath || repo || process.cwd()`), not `{REPOS_ROOT}/{repo}`. UI must pass a resolved path **or** harness must resolve names like `tasks`/`events` do. **Plan: resolve repo names in harness when `repoPath` omitted** via `createHarnessRoutes(config)` + `validateRepoPath`.
3. No `/ui` routes or static assets today (`src/index.ts`). Prefer **light Hono HTML** in `src/routes/ui.ts` (embedded JS) so Docker already shipping `dist/` needs no new `COPY public` (Dockerfile currently copies only `dist`).
4. Auth: when `SERVER_API_KEY` set, browser UI must send `X-API-Key` / `Authorization: Bearer` on API calls; when unset, APIs stay open (existing behavior).
5. Save target per AC3: `{REPOS_ROOT}/{repo}/.agents/specs/{id-or-filename}.spec.md` (create `.agents/specs` if missing).

### Acceptance Criteria (measurable)
| ID | Criterion |
|----|-----------|
| **AC1** | `GET /ui/spec-editor` returns interactive HTML UI that can list/open/edit/author specs (repo field + list + editor surface). |
| **AC2** | On edit (debounced), UI calls `POST /specs/validate` and surfaces `valid` / `errors` (highlight or status panel for schema/missing fields). |
| **AC3** | **Save & Run** writes Markdown to that repo’s `.agents/specs/` and dispatches harness via `POST /harness/runs` with resolved repo path; returns/displays `runId` (202). |

### Out of scope
- Visual AC builder, dependency graph viz, stage-config designer (description aspirational only).
- Cloud SDK, Hermes/OpenCode runners, SSE streaming of harness output beyond showing `runId` + link/poll hint.
- Auth redesign (cookies/OAuth); only optional API-key field in UI.
- Editing specs outside `.agents/specs/` (list may still show `.cursor/specs` / `specs/` from existing lister; Save always writes `.agents/specs/`).
- Changing QualifiedSpec Zod schema shape.
- Committing plan artifacts before Step 8.

---

## 2. Technical Design & Architecture

**Stack:** Node 20 + TypeScript ESM + Hono + Zod. Layers: routes (thin) + services (IO/validation). No DB / no frontend framework.

### Layer edits

| Layer | Path | Change |
|-------|------|--------|
| services | `src/services/spec-schema.ts` | Add `readRepoSpecFile`, `writeRepoSpecFile` (safe basename → `.agents/specs/`) |
| routes | `src/routes/specs.ts` | `GET /repos/:repo/specs/:file`, `PUT /repos/:repo/specs/:file` (Zod body) |
| routes | `src/routes/harness.ts` | `createHarnessRoutes(config)`; when `repoPath` absent and `repo` present, resolve via `validateRepoPath` |
| routes | `src/routes/ui.ts` (**new**) | `GET /ui/spec-editor` → `c.html(...)` editor shell + vanilla JS |
| entry | `src/index.ts` | Mount `uiRoutes` (no auth); wire `createHarnessRoutes(config)` |
| tests | `src/routes/ui.test.ts` and/or extend `specs` / `harness` tests | AC-mapped route tests |
| docs (minimal) | `README.md` and/or `AGENTS.md` Architecture | One-line `/ui/spec-editor` + API note |
| hygiene | `.agents/specs/index.PRD` | Mark Phase 3 / Next #14 when landing (implement step) |

### UI behavior (vanilla)

```text
Browser GET /ui/spec-editor
  → HTML: repo input, optional API key, spec list, Markdown textarea,
          Validate status, Save, Save & Run, runId display
  → JS:
       list:   GET /repos/:repo/specs
       open:   GET /repos/:repo/specs/:file
       validate (debounce ~300ms): POST /specs/validate { content }
       save:   PUT /repos/:repo/specs/:file { content }
       run:    save then POST /harness/runs { spec: content, repo }
```

Filename for new specs: derive from frontmatter `id`/`slug` or user field; ensure `.spec.md` suffix; reject `..`, `/`, `\`.

### API additions (thin)

**GET `/repos/:repo/specs/:file`**
- Validate repo; read `{resolved}/.agents/specs/{file}` (also allow open if file appears under existing list paths only if still under resolved repo root).
- Prefer: only read under `.agents/specs/` for write symmetry; for browse of `.cursor/specs`, allow read if `listRepoSpecs` returned that path and still under `resolvedPath` (realpath check).

**PUT `/repos/:repo/specs/:file`**
- Body: `{ content: string }` (Zod).
- Optional: validate before write; still allow write of invalid draft? Prefer **validate then write** for Save; Save & Run must be valid.
- Write UTF-8 to `.agents/specs/{file}`; `mkdirSync(..., { recursive: true })`.
- Return `{ ok: true, path: relativeOrSafePath }`.

**Harness fix**
```typescript
// pseudo
if (rawRepoPath) repoPath = rawRepoPath;
else if (repo) {
  const v = validateRepoPath(config.REPOS_ROOT, repo);
  if (!v.valid) return 400;
  repoPath = v.resolvedPath!;
} else repoPath = process.cwd(); // keep prior default for tests
```

### Invariant checks (`config.json.invariants`)
- `localSdkRuntimeOnly` ✓ (UI no SDK)
- `thinRoutesNoBusinessLogic` ✓ (IO helpers in `spec-schema`)
- `noHardcodedRepoAbsolutePaths` ✓
- `secretsFromEnvOnly` ✓
- `disposeAgentsAlways` ✓ (unchanged; harness owns agents)
- `settingSourcesEmptyUnlessIntentional` ✓
- `commitPlanFilesOnlyAtStep8` ✓

### Fable domain
`fable.enabled` + `autoDetectDomain`: no IaC/K8s/migration/data-script signals. No `fable-domain` binding.

---

## 3. Step-by-Step Plan

### Step A — Spec file IO helpers (services)
- **Action:** Add `assertSafeSpecFilename(name)`, `readRepoSpecFile(repoPath, file)`, `writeRepoSpecFile(repoPath, file, content)` in `spec-schema.ts`. Confinement: resolved path must stay under `path.join(repoPath, '.agents', 'specs')` (or under repo root for allowed read of listed files).
- **Files:** `src/services/spec-schema.ts`, extend `src/services/spec-schema.test.ts`
- **Check:** Unit tests for traversal rejection and round-trip write/read.

### Step B — Spec routes + harness repo resolution
- **Action:** Add GET/PUT single-spec handlers on `createRepoSpecRoutes`. Convert harness to `createHarnessRoutes(config)` and resolve `repo` names. Update `index.ts` mounts; update `harness.test.ts` to use factory (tmp `REPOS_ROOT` or keep `repoPath` absolute as today).
- **Files:** `src/routes/specs.ts`, `src/routes/harness.ts`, `src/index.ts`, `src/routes/harness.test.ts`, optional `src/routes/specs.test.ts`
- **Check:** Route tests for PUT write + GET read; POST `/harness/runs` with `{ repo: name }` against temp repos root.

### Step C — UI route + wire + docs hygiene
- **Action:** Implement `src/routes/ui.ts` with `GET /` or app-level `GET /ui/spec-editor` returning self-contained HTML/JS (list, editor, debounce validate, Save, Save & Run, API-key header helper). Mount without auth. Mention in README/AGENTS; tick `index.PRD` item 14 when implementing.
- **Files:** `src/routes/ui.ts`, `src/routes/ui.test.ts` (status 200 + body contains editor markers), `src/index.ts`, `README.md` and/or `AGENTS.md`, `.agents/specs/index.PRD`
- **Check:** `GET /ui/spec-editor` → 200 `text/html`; manual curl of validate/save/run path.

**Dependency order:** A → B → C.

**Expected file budget:** ~6–8 product files (fits near `dagThresholds.maxExpectedFiles: 6`; if over, prefer sequential execMode).

---

## 4. Permissions, Tenancy & i18n

| Area | Plan |
|------|------|
| RBAC | None beyond existing optional `SERVER_API_KEY`. UI ships optional key field. |
| Tenancy | N/A (`domain.tenancyField` empty). Isolation = repo path under `REPOS_ROOT`. |
| i18n | None (`frontend.i18n.framework: none`). English UI labels only. |

---

## 5. Test Coverage

| AC | Test case | Method / location |
|----|-----------|-------------------|
| AC1 | `GET /ui/spec-editor` returns 200 HTML with editor chrome (textarea / Save & Run control) | `ui.test.ts` → `it("serves spec editor UI")` |
| AC1 | UI/list wiring: `GET /repos/:repo/specs` still returns specs array (regression) | existing or `specs.test.ts` |
| AC2 | `POST /specs/validate` valid Markdown → `{ valid: true }` (regression) | `spec-schema.test.ts` / route test |
| AC2 | Invalid structured object → `{ valid: false, errors }` surfaced shape UI expects | `spec-schema.test.ts` |
| AC2 | (Manual) debounce validate updates status panel | smoke: curl + browser if available |
| AC3 | `PUT /repos/:repo/specs/:file` writes under `.agents/specs/` | `specs.test.ts` → `it("writes spec file")` |
| AC3 | Traversal filename rejected | `spec-schema.test.ts` / route 400 |
| AC3 | Save then `POST /harness/runs` with `{ spec, repo }` → 202 + `runId` when repo name resolves under `REPOS_ROOT` | `harness.test.ts` extended |
| AC3 | File exists on disk after PUT | assert `fs.existsSync` in route test |

**Verification commands:** `npm run typecheck`, `npm test`, `npm run build`, `npm run scan-secrets`; optional `curl http://localhost:3000/ui/spec-editor`.

---

## 6. Invariants (Do Not Violate)

1. **Local SDK only** — UI and new routes must not introduce cloud runtime.
2. **Thin routes** — filesystem + parse logic stays in `spec-schema` (or small helpers); handlers validate + delegate.
3. **No hardcoded absolute repo paths** — always `validateRepoPath` / `REPOS_ROOT`.
4. **Secrets from env only** — never embed `SERVER_API_KEY` / `CURSOR_API_KEY` in HTML.
5. **Dispose agents** — unchanged; do not bypass orchestrator/runner dispose paths.
6. **`settingSources: []`** — unchanged for any SDK path.
7. **Surgical scope** — no AC-builder/graph; no unrelated refactors of task/event routes.
8. **Plan commits only at Step 8.**

---

## 7. Pre-PR Checklist

- [x] Layer boundaries respected (routes thin; services hold IO).
- [x] Domain entities and mappings encapsulated (N/A — no ORM; QualifiedSpec reuse only).
- [x] Schema migrations created (N/A — no DB).
- [x] Authorization checks applied (existing middleware retained on API; UI key field documented).
- [x] i18n keys declared (N/A).
- [x] Test cases cover all ACs (section 5).
- [x] Harness `repo` name resolution verified so Save & Run works from browser.
- [x] Dockerfile still serves UI (HTML in compiled route → no missing static COPY).
- [x] README/AGENTS/`index.PRD` status consistent (MEMORY: packaging/docs sync).

---

## 8. Open Questions

| # | Topic | Resolution |
|---|--------|------------|
| 1 | Fancy AC builder / dependency graph / stage UI in Description vs ACs | **Resolved:** OOS for this PR; Markdown editor satisfies AC1–AC3. |
| 2 | Where UI assets live (`public/` vs Hono HTML) | **Resolved:** Hono `c.html` in `src/routes/ui.ts` to avoid Dockerfile/static COPY gap. |
| 3 | Harness `repo` vs absolute `repoPath` | **Resolved:** Fix harness to resolve repo **names** via `REPOS_ROOT` (required for AC3 from UI). |
| 4 | Save invalid drafts? | **Resolved:** Save may validate-and-warn; **Save & Run** requires `validateSpecPayload` success before write+dispatch. |
| 5 | Auth for `/ui` | **Resolved:** UI public; APIs remain protected; optional API-key input in page. |

No blocker remaining for interview/implement. If Step 2 wants stricter “Save also requires valid”, flip one flag in PUT handler.
