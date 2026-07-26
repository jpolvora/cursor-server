---
id: null
slug: 40-main-page-dashboard
title: "Main page dashboard shell (root UI, login, left menu, SaaS layout)"
source: local
specDate: 2026-07-26
status: draft
version: 0.1.0
---

# Specification — Main page dashboard shell

## Description

`GET /` currently has no operator-facing UI (health lives elsewhere; ops surfaces are under `/ui/*`). Add a **root main page** that is the primary homelab ops entry: unauthenticated visitors see a login dialog (API key / tenant key as already used by the server); authenticated visitors land on a **dashboard** with a left navigation menu and a center/main content region that swaps by menu selection.

Design bar: lightweight professional SaaS, calm and readable, anti–AI-slop (no generic purple gradients, no decorative glow stacks, no pill-chip clutter, no card-everywhere layout). Prefer one clear composition, purposeful typography, and restrained color. Existing standalone pages (`/ui/board`, `/ui/prompt`, `/ui/spec-editor`) remain reachable; the shell links or embeds them in the main pane without breaking those deep links.

Left menu (minimum):

1. **Dashboard** — summary / home content in the main pane.
2. **Kanban board** — entry to the board (`/ui/board` or in-pane embed).
3. **Projects** — list/manage projects (create/edit/delete); pairs with `39-board-projects-management` for CRUD behavior.
4. **Configuration** — key/value settings UI with seeded **default options** operators can edit and persist.

Out of scope: replacing board lane/execution logic (`34`); rewriting the full aspirational spec-editor (`36`); public OAuth; marketing landing page.

## Acceptance Criteria

- AC1: `GET /` returns an HTML shell (not empty / not only JSON). Unauthenticated users see a login dialog (or equivalent gate) that accepts the same credentials the API already uses (`X-API-Key` / Bearer / stored client-side for subsequent UI calls).
- AC2: Successful login redirects to or reveals the dashboard; failed login shows a clear non-leaky error and does not grant menu access to protected content.
- AC3: Authenticated layout includes a left menu and a main/center content container; selecting a menu item updates the main container (SPA-style sections or soft navigation) without losing the shell chrome.
- AC4: Left menu includes entries for Dashboard, Kanban board, Projects, and Configuration; Kanban board entry navigates to or embeds `/ui/board`.
- AC5: Projects menu shows project list with add/edit/delete affordances (implement fully with `39`, or stub list + clear link/placeholder if `39` ships later — document which in the plan).
- AC6: Configuration menu provides a key/value editor; ships with documented default option keys (e.g. default agent role, default harness runner, UI theme/density preference, and at least one board-related preference); values persist across reload (SQLite or equivalent server-side store preferred over localStorage-only for shared homelab use).
- AC7: Visual design meets the anti-slop bar: restrained palette/CSS variables, no purple-on-white default theme, no glow-heavy chrome, no hero marketing overlay; works on desktop and usable on narrow viewports (menu may collapse).
- AC8: Typecheck, build, and route/UI tests cover `GET /` HTML, auth gate behavior for protected shell APIs if any, and at least one config default seed; no real Cursor cloud calls required in CI.

## Notes

- Depends on: client auth (`03`), existing `/ui/*` pages; coordinates with `39-board-projects-management` for Projects pane.
- Prefer serving shell from app root routes (not only under `/ui`) so `http://localhost:3000/` is useful.
- Deep links to `/ui/board`, `/ui/prompt`, `/ui/spec-editor` must keep working.
- Default config keys and storage location to be finalized in plan; do not invent new secret storage — secrets stay `secret_ref` / env.
