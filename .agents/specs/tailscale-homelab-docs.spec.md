---
id: null
slug: tailscale-homelab-docs
title: "Tailscale-oriented bind defaults and client access docs"
source: local
specDate: 2026-07-24
---

# Specification — Tailscale-oriented bind defaults and client access docs

## Description

Document and confirm **Tailscale-friendly bind defaults** so remote IDE clients on the tailnet can reach cursor-server on the home-lab host without assuming public internet exposure.

Compose packaging already landed (`Dockerfile`, `docker-compose.yml`, [docs/docker.md](../../../docs/docker.md)). This slice **extends** HOST/bind guidance and client reachability docs; it does **not** re-ship or redesign Docker packaging.

Goals:

1. Clear **HOST / bind** guidance for bare-metal and Compose: listen on `0.0.0.0` (all interfaces) so the published port is reachable via the host’s Tailscale IP (and optionally LAN).
2. **Client reachability notes**: how home/company laptops on Tailscale call the API (`http://<host-tailscale-ip>:<PORT>`), health smoke from a remote client, and explicit non-assumption of public exposure.
3. Align **README**, **docs/docker.md**, **`.env.example`**, and **AGENTS.md** so agents and humans do not treat Tailscale docs as unfinished after this lands.

This is Phase 1 item 2 from `.agents/specs/index.PRD` (homelab-ready). Sibling features (client auth, repo validation, async queues) remain separate specs.

## Acceptance Criteria

- AC1: Documentation states that the recommended HTTP bind for homelab/Tailscale access is `HOST=0.0.0.0` (not `127.0.0.1`), for both bare-metal (`npm run dev` / `npm start`) and Compose, so remote tailnet clients can reach the published port.
- AC2: `.env.example` keeps `HOST=0.0.0.0` and includes a short comment that this bind is required for Tailscale/LAN clients; `127.0.0.1` is localhost-only and blocks remote access.
- AC3: App/config default for `HOST` remains `0.0.0.0` (already in `src/config.ts` and Compose); no change required unless an audit finds a conflicting default — any code touch must preserve that default.
- AC4: README Deployment / Network access section explains client URL shape using the host Tailscale IP (or MagicDNS name if the operator uses it) plus `PORT`, and states that public internet exposure is not assumed or required.
- AC5: `docs/docker.md` Network / Tailscale section is expanded beyond a one-liner: host-layer responsibility, Compose publish mapping, example remote `curl http://<tailscale-ip>:3000/health`, and a note that Tailscale must be installed/running on the **host** (not inside the cursor-server container in this slice).
- AC6: AGENTS.md Deployment context and Planned areas reflect that Tailscale-oriented bind/docs are the current deliverable; when this feature lands, remove or rephrase the “Tailscale-oriented bind/config defaults and docs” Planned areas bullet so status docs stay consistent (same-turn sync with README Roadmap Next → move Tailscale defaults to Now / Done as appropriate).
- AC7: Explicit out-of-scope is documented in Notes (and not implemented): client API auth, Tailscale Serve/Funnel as a required path, ACL policy authoring, repo-validation API, async task queues, Umbrel App Store manifest, and re-scoping of Compose packaging.
- AC8: `npm run typecheck` and `npm run build` still pass if any non-doc files change; prefer docs-only edits. No requirement to run Docker or live Tailscale smoke in CI for this slice (manual verification on a tailnet host is sufficient when available).

## Child Tasks

### Task — HOST / bind docs and `.env.example`

- **Status:** todo
- **Description:** Document recommended `HOST=0.0.0.0` for Tailscale/LAN; clarify that `127.0.0.1` breaks remote clients; keep Compose and app defaults aligned.

### Task — Client reachability docs

- **Status:** todo
- **Description:** Expand README Network access and `docs/docker.md` Network / Tailscale with URL examples, remote health smoke, host-vs-container Tailscale responsibility, no public exposure assumed.

### Task — Status / roadmap sync

- **Status:** todo
- **Description:** When landing, update README Roadmap, AGENTS.md Planned areas / Deployment notes, and optionally `index.PRD` checkbox for this feature so docs do not contradict shipped status.

## Notes

- **Index:** `.agents/specs/index.PRD` Phase 1 — Tailscale-oriented defaults and docs; Next specs #2.
- **Canonical packaging already done:** do not recreate Dockerfile/Compose work; only extend Tailscale/bind/client-access documentation and safe default comments.
- **Out of scope:** `client-auth.spec.md`; `repo-validation.spec.md`; `async-task-queue.spec.md`; Tailscale Serve/Funnel as mandatory; subnet router / exit-node setup; firewall ACL deep-dives beyond “no public exposure assumed”; public reverse-proxy hardening.
- **Assumed defaults (autoMode):** (1) Expand existing README + `docs/docker.md` + AGENTS.md rather than adding a new `docs/tailscale.md`. (2) Docs-first; keep existing `HOST=0.0.0.0` code/Compose defaults unless a conflict is found. (3) Direct tailnet IP + published port is the documented path; Serve/Funnel remain optional/out of scope.
- **MEMORY:** Packaging status doc sync — when shipping docs, keep README Roadmap / AGENTS Planned areas aligned in the same turn.
- **Invariants:** `localSdkRuntimeOnly`, `secretsFromEnvOnly`, local-first / homelab-first, Tailscale access without public internet exposure.
- **Verification hint:** On a machine with Tailscale: from a second device on the same tailnet, `curl http://<server-tailscale-ip>:3000/health` → `{"status":"ok"}` (manual; not CI-blocking).
