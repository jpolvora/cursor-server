---
id: null
slug: 28-fix-docs-roadmap-sync
title: "Fix AGENTS/README roadmap sync for shipped features"
source: local
specDate: 2026-07-25
complexity: low
status: completed
---

# Specification — Fix AGENTS/README roadmap sync for shipped features

## Description

Multiple verify-plan reports found shipped features still listed under AGENTS.md Planned areas / README “still open” language (Hermes, OpenCode, streaming, scheduled review, client auth, etc.), while `index.PRD` checkboxes and merged PRs say done. MEMORY trap “Packaging status doc sync” applies: agents treat contradictory docs as unfinished.

Parent verify: gaps across `15-hermes-integration`, `02-tailscale-homelab-docs`, `08-task-streaming`, `09-scheduled-review-jobs`, docker-compose soft notes.

## Acceptance Criteria

- AC1: Audit `AGENTS.md` Planned areas, Roadmap, and What-not-to-do against current `src/` + merged PRs from `ms-20260725T230442Z`; move landed items out of Planned / “do not implement without go-ahead” when code exists.
- AC2: Audit README Roadmap / Deployment / Hermes-OpenCode wording the same way; remove “still open” for adapters that are registered in code (`hermes`, `opencode`).
- AC3: Keep honest caveats for **incomplete** items (e.g. until fix specs 20–25 land, note known gaps briefly rather than claiming full AC completion).
- AC4: No application runtime code changes required unless a doc link path is broken.
- AC5: `npm run typecheck` still passes (docs-only PR OK).

## Notes

- Docs-only; follow MEMORY “Packaging status doc sync” / docs scope-creep guard — do not sneak unrelated `src/` edits into this change set.
- Prefer running **after** or **with** related fix specs so docs do not claim fixes that are not yet merged; if run alone, describe current code truth (partial Hermes/OpenCode/tenant/MCP).

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #17 open). Not merged to develop/master yet.
