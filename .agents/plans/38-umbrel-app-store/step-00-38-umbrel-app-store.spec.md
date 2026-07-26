---
id: null
slug: 38-umbrel-app-store
title: "Umbrel App Store manifest"
source: local
specDate: 2026-07-26
status: draft
version: 0.1.0
---

# Specification — Umbrel App Store manifest

## Description

Package cursor-server for Umbrel App Store listing beyond “custom Compose stack”: provide the store manifest / app metadata Umbrel expects, wired to the existing Docker Compose path (`01-docker-compose`, `docs/docker.md`). Do not invent a second packaging system; reuse Compose env/volumes and Tailscale-friendly bind defaults.

Depends on: `Dockerfile`, `docker-compose.yml`, documented env vars.

## Acceptance Criteria

- AC1: Umbrel app manifest (and required companion files per current Umbrel store format) live in-repo and reference the Compose stack.
- AC2: Documented install path for Umbrel users (README or `docs/`) matches the manifest; env secrets stay out of the image.
- AC3: Existing non-Umbrel Compose/bare-metal paths remain unchanged.
- AC4: Typecheck/build still pass; no runtime dependency on Umbrel APIs for non-Umbrel deploys.
- AC5: Non-goals for v1: submitting/publishing to the public store on the user’s behalf, Funnel/public exposure, cloud runtime.

## Notes

- Confirm Umbrel store schema version at implement time (manifest fields drift).
- Compose remains the production packaging path; store listing is distribution UX.
