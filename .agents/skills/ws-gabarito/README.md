# Gabarito

Operational communication skill for agents: eleven directives plus style discipline.

## What it does

- Runs **every turn** (always-on) unless opted out
- Improves accountability, anti-sycophancy, clarification, verification, anti-regression memory consult, and prose quality
- First reply only: short signal line (*"Gabarito in use."*)

## Consumer projects

Listed in `shared/AGENTS.md` § Skill loading (autoload every prompt; or root `AGENTS.md` when authoring against the source repo). Works alongside `senior-developer` (global or local install), `ws-karpathy-guidelines`, and **ws-caveman full**; does not replace specs or engineering rules. See hub § Precedence and § Opt-out.

## Caveman

**ws-caveman full** autoloaded with Gabarito unless `stop ws-caveman` / `normal mode`. Level switches: `/ws-caveman lite|ultra|…`. See `../ws-caveman/SKILL.md`.

## Opt-out

`stop ws-gabarito`, or `normal mode` (ws-caveman off: `stop ws-caveman`). Canonical table: [`shared/AGENTS.md`](../shared/AGENTS.md) § Opt-out (or root [`AGENTS.md`](../../../AGENTS.md) § Opt-out when authoring against the source repo).

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Agent instructions (authoritative) |
| `README.md` | This summary |
