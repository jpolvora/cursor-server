---
id: null
slug: 42-ui-shell-revamp
title: "UI revamp — unified SaaS app shell with route-rendered views"
source: local
specDate: 2026-07-26
status: completed
version: 0.1.0
---

# Specification — UI revamp (unified app shell)

## Description

The operator UI is four disconnected surfaces. `GET /` (spec `40`) is a shell with hash-toggled panes for Dashboard / Projects / Configuration, while `/ui/board`, `/ui/prompt`, and `/ui/spec-editor` are standalone full pages that each re-implement their own chrome, palette, and API-key handling. Every surface duplicates a `<style>` block; the board alone is a ~795-line inline monolith. Leaving the shell to reach the Kanban board is a hard navigation into a visually different app.

Revamp this into **one application shell**: a fixed left menu, a compact top bar, and a single main container into which every view is rendered **according to route**. Reference composition is the `matrix` web admin shell (`L:\source\matrix\web`): fixed sidebar with grouped nav items and an explicit active state, sticky header, and a main column that hosts the routed view. Adopt that structure, not its Binance-yellow palette.

Visual target: **compact professional SaaS console**, tuned to Cursor IDE density — small UI type (~13px base), tight row heights, hairline borders, restrained dark palette, monospace reserved for identifiers/logs. Explicitly anti-AI-slop: no gradients, no glow or shadow stacks, no emoji chrome, no hero banner, no pill-chip clutter, no card-around-everything.

All existing views become shell views rendered in the main container, including the Kanban board. Existing deep links (`/ui/board`, `/ui/prompt`, `/ui/spec-editor`) must keep working and must render inside the shell with the matching nav item active.

Approach constraint: keep the server-rendered Hono + template-literal model. Do **not** introduce a frontend framework, bundler, or build step. Routing is server-side (one route per view, shell rendered around it); a client-side SPA router is out of scope.

Out of scope: changing board lane semantics or execution control (`34`), changing spec-editor authoring features (`36`), changing prompt-widget task semantics (`35`), any API contract change, new auth mechanisms, the public marketing website (`41`).

## Acceptance Criteria

- AC1: A single shared design-token stylesheet is defined once and served as a cacheable static-style route (e.g. `GET /ui/app.css`); the dashboard, board, prompt, and spec-editor surfaces all consume it instead of each duplicating a full `<style>` block with its own palette.
- AC2: A reusable shell renderer produces every operator page: fixed left menu, compact top bar showing the current view, and one main content container. Views supply only their own body markup, view-scoped styles, and client script.
- AC3: The left menu renders nav entries for Dashboard, Kanban board, Projects, Prompt, Spec editor, and Configuration. The entry matching the current route carries a visible active state (`aria-current` plus active styling) and no other entry does.
- AC4: The Kanban board renders **inside** the shell main container at its route — same sidebar and top bar as every other view — rather than as a standalone page with separate chrome.
- AC5: `GET /ui/board`, `GET /ui/prompt`, and `GET /ui/spec-editor` continue to return 200 HTML and preserve their current behavior (board lanes/drag/start-pause-finish, prompt submit + SSE stream, spec editor tabs/validate/save/run). Existing client-JS routes (`/ui/prompt-widget.js`, `/ui/spec-editor-client.js`) keep working, and `data-cursor-prompt-widget` stays embeddable outside the shell.
- AC6: The login gate from `40` still guards operator content: unauthenticated visitors get the gate, the API key persists in `sessionStorage` under the existing key, and a failed key shows a clear non-leaky error. API-key entry is handled once by the shell rather than by a separate input on each page.
- AC7: Design tokens encode the compact IDE-like density: base UI font size 12–13px, sidebar ≤ 220px, top bar ≤ 44px, nav row height ≤ 32px, border radius ≤ 6px, hairline (1px) borders, and a monospace family applied only to identifiers, code, and log output.
- AC8: Anti-slop check on shipped CSS: no `linear-gradient`/`radial-gradient` in page chrome, no purple-dominant palette, no decorative `box-shadow` glow, no emoji in nav or headings. The existing accent token (`--accent: #3d8bfd`) and dark surfaces are retained.
- AC9: The shell is usable on a narrow viewport — the left menu collapses behind a toggle below a documented breakpoint and the main container stays readable without horizontal scroll of the chrome.
- AC10: `npm run typecheck` and `npm run build` pass. Route tests cover: shared stylesheet route returns CSS, every view route returns 200 HTML wrapped in the shell, the active nav entry matches the route, and the pre-existing assertions in `src/routes/dashboard.test.ts` and `src/routes/ui.test.ts` either still pass or are updated in the same change with equivalent coverage.

## Notes

- Depends on: `40-main-page-dashboard` (root shell, login gate, `/settings`), `39-board-projects-management` (Projects pane), `33-board-ui`, `35-agent-prompt-widget`, `36-spec-editor-aspirational-ui`.
- Reference only, do not copy code: `L:\source\matrix\web` — `src/components/layout/AdminLayout.tsx`, `AppSidebar.tsx`, `AppHeader.tsx`, `src/styles/tokens.css`.
- Tests currently anchor user-visible strings (`Kanban Board`, `Spec Editor`, `Agent Prompt`, `AC Builder`, `--accent`, `#3d8bfd`, `Log out`, `project-modal`, …). Preserve those markers or update the assertions deliberately in the same change; do not let a rename silently drop coverage.
- Refactor is presentation-layer only: no route paths removed, no request/response contract changed, no business logic moved out of `services/`.
- Confirmed with owner: routing is **server-side** — one route per view, each returning the full shell with its view in the main container, nav as real links. No fetch-and-swap, no hash router, no bundler.
- Confirmed with owner: the board's inline monolith is **extracted** into a view module with its client script on a `/ui/board-client.js` route, matching how prompt and spec-editor are already split. Board behavior stays unchanged.
- `ui_theme` / `ui_density` settings from `40` should keep driving `<html data-theme data-density>`; density values must map onto the new token scale.

### [2026-07-26] Revision: implemented shared shell (`src/routes/shell.ts`), `/ui/app.css` + `/ui/app.js`, view modules for dashboard/projects/config/board, and migrated prompt + spec-editor onto the shell (Prompt: "revamp ui localhost:3000 … SAAS shell style, compact like cursor ide fonts, no ai slop")
