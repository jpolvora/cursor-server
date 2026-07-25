## Summary

- Documents Tailscale/LAN bind defaults (`HOST=0.0.0.0`) for bare-metal and Compose, with `.env.example` comment guidance.
- Adds client access URL shape (`http://<host-tailscale-ip-or-MagicDNS>:<PORT>`) in README and expands `docs/docker.md` Network / Tailscale (no public exposure assumed; Serve/Funnel out of scope).
- Syncs status: README Roadmap Now, AGENTS Planned areas, and `.agents/specs/index.PRD` Phase 1 / Done for Tailscale docs.

**Docs-only** — no app/Compose code changes; defaults already `0.0.0.0`.

**Next (separate spec):** client-auth for API callers on the tailnet.

## Test plan

- [x] `npm run typecheck` / `npm run build` green
- [x] Step 6 code review clean (docs ACs AC1–AC8)
- [x] Step 7 skipped (no API/UI surface; verify green)
- [ ] Optional: from a Tailscale client, `curl http://<host>:<PORT>/health`

