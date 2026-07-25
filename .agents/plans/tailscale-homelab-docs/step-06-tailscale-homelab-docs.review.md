---
us: tailscale-homelab-docs-20260724T223349Z
slug: tailscale-homelab-docs
step: 6
base: HEAD (bb1d1da) / anchor uswf/tailscale-homelab-docs-20260724T223349Z/before-step-6
reviewedAt: "2026-07-24T22:45:00Z"
reviewer: Cursor Grok 4.5
mode: AUTO FULL
---

# Step 6 — Code Review: tailscale-homelab-docs

**Scope:** Docs-only Tailscale bind / client-access slice vs workflow anchor (uncommitted working tree).  
**In-scope files:** `.env.example`, `README.md`, `docs/docker.md`, `AGENTS.md`, `.agents/specs/index.PRD`.  
**Excluded:** `dist/`, `node_modules/`, managed skills, `{plansDir}` artifacts except this report, CI YAML. Mirror spec `.agents/specs/tailscale-homelab-docs.spec.md` is workflow product (untracked); not product-code scope.

## Diff inventory

| Path | Status |
|------|--------|
| `.env.example` | modified — HOST Tailscale/LAN comment |
| `README.md` | modified — Network access + Roadmap Now/Next |
| `docs/docker.md` | modified — Network / Tailscale expansion |
| `AGENTS.md` | modified — Deployment bind/URL; Planned areas drop Tailscale |
| `.agents/specs/index.PRD` | modified — Phase 1 / Next #2 / Done log |

No `src/`, `Dockerfile`, or `docker-compose.yml` changes. App default `HOST=0.0.0.0` (`src/config.ts:L6`) and Compose `HOST: "0.0.0.0"` (`docker-compose.yml:L9`) audited unchanged (AC3).

## AC cross-check (AC1–AC8)

| AC | Verdict | Evidence |
|----|---------|----------|
| AC1 `HOST=0.0.0.0` bare-metal + Compose | Pass | README Network; `docs/docker.md` App/Compose layers; AGENTS Bind |
| AC2 `.env.example` comment | Pass | `.env.example:L11-L13` |
| AC3 preserve code/Compose default | Pass | No code/Compose touch; defaults still `0.0.0.0` |
| AC4 README client URL + no public exposure | Pass | README URL shape + example curl + “not assumed or required” |
| AC5 `docs/docker.md` expanded | Pass | Host Tailscale, layer table, publish mapping, remote curl, Serve/Funnel OOS |
| AC6 status sync | Pass | README Roadmap **Now** includes Tailscale; Planned-areas bullet removed; index `[x]` + Done log |
| AC7 OOS not implemented | Pass | Auth/repo-validation/queues/Compose redesign absent from diff; Serve/Funnel called out as OOS |
| AC8 typecheck/build if non-doc | Pass / N/A | Docs-only; build not required |

## Pattern sweep (`MEMORY.md`)

| Pattern | Result |
|---------|--------|
| Packaging status doc sync | **Satisfied** — README Roadmap, AGENTS Planned areas, index Phase 1 / Next / Done aligned same turn; no unfinished-vs-landed contradiction |
| Docker runtime npm ci husky | N/A — no Dockerfile change |
| Review Patterns section | None defined in MEMORY |

## Invariants checklist

| Invariant | Result |
|-----------|--------|
| `secretsFromEnvOnly` | Pass — diff adds comments only; `.env.example` keeps placeholder `cursor_...` / empty `OPENCODE_API_KEY=`; no real secrets |
| `localSdkRuntimeOnly` | Pass — docs unchanged on cloud runtime |
| `noHardcodedRepoAbsolutePaths` | Pass — no path hardcoding added |
| `thinRoutes` / dispose / settingSources | N/A — no app code |
| `commitPlanFilesOnlyAtStep8` | Pass — no commit this step |

## Scope / security

- No client-auth, repo-validation, async-queue, or Compose redesign in diff.
- No Serve/Funnel as required path; documented as OOS.
- Secrets scan of diff: no API keys, tokens, or credential material beyond existing placeholders.

## Fable-judge (light)

**Verdict:** `VERIFIED`

| Fraud | Result |
|-------|--------|
| Weakened Checks | None |
| False Completion | None — ACs evidenced in working-tree diff; live Tailscale smoke not falsely claimed |
| Scope Creep | None — planned files only |
| Unauthorized Action | None — no commit/push |

Caveat (informational only): live remote `curl` health on a real tailnet remains operator-manual (AC8); not a review finding.

## Triage → investigate

Hypotheses considered and dropped:

1. **Shipped-status contradiction (MEMORY Warning bar)** — Evidence: Tailscale on README **Now**, removed from AGENTS Planned areas, index checkboxes + Done log. No sibling unfinished claim. **Dropped.**
2. **AGENTS Packaging “landed with packaging” chronology** — Evidence: `AGENTS.md:L25` ties Tailscale docs wording to packaging sentence. Failure would be mild timeline confusion, not “still unfinished.” Step 5 already scored as optional nit. Does not meet Warning bar (no status contradiction). **Dropped** (Suggestion not elevated; precision-before-volume).
3. **Secrets in `.env.example`** — placeholders only. **Dropped.**
4. **Scope creep into auth / Compose** — auth remains Planned / Next; Compose files untouched. **Dropped.**

---

## Critical

_No feedback_

## Warning

_No feedback_

## Suggestion

_No feedback_

---

**Apply fixes?** No — clean review (0 Critical / 0 Warning). Under `[AUTO]`, no fix substep required.

**Verification:** `clean`
