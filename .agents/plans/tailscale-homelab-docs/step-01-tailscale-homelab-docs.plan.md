---
slug: tailscale-homelab-docs
title: "Tailscale-oriented bind defaults and client access docs"
planDate: 2026-07-24
complexity: simple
execMode: sequential
---

# Plan — Tailscale-oriented bind defaults and client access docs

## Goal

Document Tailscale-friendly `HOST`/bind defaults and client reachability so remote IDE clients on the tailnet can call cursor-server without public exposure. Docs-first; preserve existing `HOST=0.0.0.0` app/Compose defaults. Do not re-ship Docker packaging.

## Files to touch

| File | Change |
|------|--------|
| `.env.example` | Keep `HOST=0.0.0.0`; add short Tailscale/LAN vs `127.0.0.1` comment |
| `README.md` | Deployment / Network access: client URL via host Tailscale IP (or MagicDNS) + PORT; no public exposure assumed |
| `docs/docker.md` | Expand Network / Tailscale: host-layer Tailscale, Compose publish, example remote health curl |
| `AGENTS.md` | Deployment context + Planned areas: mark Tailscale bind/docs as this deliverable / landed when shipping |
| `.agents/specs/index.PRD` | Checkbox / Next specs #2 status when landing (optional same-turn) |

**Audit only (no change unless conflict):** `src/config.ts`, `docker-compose.yml` — confirm `HOST` default remains `0.0.0.0`.

## Out of scope

Client auth, repo validation, async queues, Tailscale Serve/Funnel as required, Compose redesign, Umbrel App Store manifest.

## AC checklist

- [x] AC1 — Docs recommend `HOST=0.0.0.0` for bare-metal and Compose
- [x] AC2 — `.env.example` comment Tailscale/LAN vs localhost-only
- [x] AC3 — App/Compose `HOST` default still `0.0.0.0`
- [x] AC4 — README client URL + no public exposure
- [x] AC5 — `docs/docker.md` Tailscale section expanded with curl example
- [x] AC6 — AGENTS (+ README Roadmap) status sync same turn
- [x] AC7 — OOS documented (Notes already in spec; keep consistent in docs if mentioned)
- [x] AC8 — `npm run typecheck` + `npm run build` if any non-doc change

## Implementation notes

- Sequential single pass; prefer surgical doc edits.
- MEMORY: packaging status doc sync — README Roadmap + AGENTS Planned areas same turn.
- Manual Tailscale smoke is sufficient; not CI-blocking.
