---
us: docker-compose-20260724T215147Z
slug: docker-compose
step: 6
base: origin/master
anchor: uswf/docker-compose-20260724T215147Z/before-step-6
reviewedAt: "2026-07-24T22:10:00Z"
reviewer: Cursor Grok 4.5
---

# Step 6 — Code Review: docker-compose

**Scope:** Packaging + docs vs `origin/master` (working tree; artifacts mostly untracked).  
**In-scope files:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docs/docker.md`, `README.md`, `.env.example`, `.agents/specs/index.PRD`, `AGENTS.md` (shipped-status drift).  
**Excluded:** `dist/`, `node_modules/`, `{plansDir}` (except this report), CI YAML.

## Diff inventory

| Path | Status vs `origin/master` |
|------|---------------------------|
| `Dockerfile` | untracked (new) |
| `docker-compose.yml` | untracked (new) |
| `.dockerignore` | untracked (new) |
| `docs/docker.md` | untracked (new) |
| `README.md` | modified (Deployment link; roadmap still stale) |
| `.env.example` | modified (Compose `REPOS_ROOT` comments) |
| `.agents/specs/index.PRD` | modified / added on branch (Compose marked `[x]`) |
| `AGENTS.md` | unmodified vs master (packaging wording still “not yet”) |

No `src/` changes. Invariants `localSdkRuntimeOnly`, `secretsFromEnvOnly`, `noHardcodedRepoAbsolutePaths` hold in packaging artifacts.

## Pattern sweep (`MEMORY.md`)

| Pattern | Result |
|---------|--------|
| Docker runtime `npm ci` husky / prepare | **Applied correctly** — runtime stage uses `npm ci --omit=dev --ignore-scripts` |
| Review Patterns section | None defined in MEMORY |

## Invariants checklist

| Invariant | Result |
|-----------|--------|
| `secretsFromEnvOnly` | Pass — no `COPY .env`; `.dockerignore` excludes `.env` / `.env.*`; samples use `cursor_...` |
| `noHardcodedRepoAbsolutePaths` | Pass — app still uses `REPOS_ROOT`; Compose sets `/data/repos` |
| `localSdkRuntimeOnly` | Pass — docs keep local `cwd` under volume |
| `thinRoutesNoBusinessLogic` / dispose / settingSources | N/A — no app code touched |
| `commitPlanFilesOnlyAtStep8` | Pass this step — no staging/commit |

## Fable-judge (adversarial packaging audit)

`config.json.fable.enabled` + `autoAudit: true`.

**Verdict:** `VERIFIED WITH CAVEATS`

### Claims vs Ground Truth

- **Claimed scope:** Compose packaging AC1–AC8; Dockerfile + compose + docs + env sample + index hygiene.
- **Ground truth:** Matching artifacts on disk; README Deployment updated; README Roadmap + AGENTS.md still describe Compose as future/unshipped (caveat → Warnings below).

### Re-run verification (this review)

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASSED (exit 0) |
| `npm run build` | PASSED (exit 0) |
| `docker compose config` | PASSED (exit 0); `REPOS_ROOT=/data/repos`, volume `repos_data`, `HOST=0.0.0.0`, port 3000 |
| Live `docker compose up` + `/health` | UNVERIFIABLE this step (stack not re-started; Step 4/5 observed earlier) |

### Fraud audit

| Fraud | Result |
|-------|--------|
| Weakened Checks | None — no test suite diluted |
| False Completion | None material — host verify re-ran green; live smoke not re-claimed here |
| Scope Creep | None — packaging/docs/index only; no drive-by `src/` |
| Unauthorized Action | None — no push/deploy/commit |

Caveats: Node 20 vs SDK `EBADENGINE` (≥22) documented; live stack not re-smoked this step.

---

## Critical

_No feedback_

## Warning

### W1 — README Roadmap still lists Compose as **Next**

- **path:** `README.md:35`
- **score:** 7/10
- **Evidence Read:** Roadmap row `**Next** | Docker Compose stack, Tailscale-friendly defaults, client auth` while Deployment already links shipped `docs/docker.md` and removes “not shipped yet”.
- **Failure Scenario:** Operators/agents treat Compose as unfinished and skip shipped `Dockerfile` / `docker-compose.yml`.
- **Missing Protection:** Roadmap not updated when packaging landed (Step 5 noted soft drift).
- **Discards:** Not Nit — contradicts shipped status in same file.
- **Sibling occurrences:** `AGENTS.md` Planned areas / packaging line (W2).
- **suggestion:**
  ```markdown
  | **Now** | Local task API, scheduler hook, SDK integration, Docker Compose packaging |
  | **Next** | Tailscale-friendly defaults, client auth |
  ```

### W2 — AGENTS.md still claims Compose packaging not in repo

- **path:** `AGENTS.md:24`, `AGENTS.md:117`, `AGENTS.md:144`
- **score:** 7/10
- **Evidence Read:** Packaging bullet: “manifest not yet in repo”; Planned areas still lists “Docker Compose stack + Umbrel-friendly packaging”; What-not-to-do still groups “Docker” with unimplemented roadmap.
- **Failure Scenario:** Future agents refuse or re-implement Compose under “confirm before building” / “not yet in repo”.
- **Missing Protection:** AGENTS.md omitted from plan file list; status not synced after land.
- **Discards:** Not out-of-scope for review — user + Step 5 explicitly flagged; contradicts shipped artifacts.
- **Sibling occurrences:** README Roadmap (W1).
- **suggestion:** Point Packaging at `docker-compose.yml` + `docs/docker.md`; remove Compose from Planned areas; drop “Docker” from the unimplemented go-ahead list (keep Umbrel App Store / Tailscale deep-dive / auth as planned).

## Nit

### N1 — index.PRD Done log omits Compose land

- **path:** `.agents/specs/index.PRD:231-236`
- **score:** 3/10
- **Notes:** Phase 1 checkboxes correctly `[x]`; Done log table still scaffold-only. Optional hygiene.
- **suggestion:** Add a 2026-07-24 row for Docker Compose packaging → `docs/docker.md`.

### N2 — STACK.md review diff scope omits packaging paths

- **path:** `.agents/skills/shared/STACK.md:69-76`
- **score:** 2/10
- **Notes:** Code Review Diff Scope lists `src/**` etc. only; this slice’s packaging would be invisible to a naive STACK-only review. Out of product AC; leave unless STACK maintenance is desired.

## Praise

- **P1** Runtime `npm ci --omit=dev --ignore-scripts` + MEMORY trap for husky `prepare` — correct production install.
- **P2** Secrets hygiene: `.dockerignore` + no `COPY .env` + Compose `env_file` + placeholder samples.
- **P3** Honest SDK Node ≥22 / `EBADENGINE` caveat without inventing unsupported packaging.
- **P4** Non-root `USER cursorserver` with volume permission notes in docs.
- **P5** Compose design matches plan: named volume default, bind-mount alternative documented, `HOST=0.0.0.0`, `PORT=3000` inside container.

## Apply fixes?

**YES** (workflow autoMode + Critical/Warning present → `04-implement-tasks` mode=fix). Fix W1 + W2 (+ N1 while touching index). Do not commit. Do not stage `{plansDir}`.
