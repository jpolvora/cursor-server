---
id: null
slug: 33-board-ui
title: "Board UI Kanban dashboard (/ui/board)"
source: local
specDate: 2026-07-25
status: draft
version: 0.1.0
---

# Specification — Board UI Kanban dashboard (`/ui/board`)

## Description

Serve a Kanban ops UI at `GET /ui/board` that lists cards from the board data plane across all repos (global board) with a per-repo filter. Columns are coarse delivery lanes aligned to full and lite `spec-to-pr*` flows; each card shows an exact step chip and repo/workflow badges. Card menu links to the existing Markdown `GET /ui/spec-editor`. Manual drag is limited to planning lanes; execution lanes are display-only until execution control (spec 34) wires Start/Pause/Finish.

Depends on: `32-board-data-plane.spec.md`. Does **not** require Start/Pause/Finish to be fully wired yet (menu can call APIs that 501 until 34 lands, or hide execution actions until available). Prefer calling real move/list APIs from 32.

## Acceptance Criteria

- AC1: `GET /ui/board` returns an interactive HTML UI (same serving style family as `/ui/spec-editor`).
- AC2: Board shows coarse columns: Backlog, Refine, Ready, Implementing, Review, Ship, Done, plus Paused and Blocked (full columns or compact equivalent).
- AC3: Global card list loads via board APIs; repo filter switches All vs a single repo without changing data model.
- AC4: Each card displays title, repo badge, workflow badge (`full` / `lite` / unset), step chip (`step_label`), and active-run status pill when `active_run_id` is present.
- AC5: Card menu includes at least: Open in spec-editor (deep link with repo/file context when export path known), and placeholders or wired actions for Start / Pause / Finish / Export / Delete consistent with available APIs.
- AC6: Drag-and-drop (or equivalent move UI) only succeeds for Backlog / Refine / Ready; drops onto run-locked or execution columns are rejected with user-visible feedback.
- AC7: UI refreshes card state via polling `GET /board/cards` (SSE not required for this spec).
- AC8: Mutating API calls use existing client authentication (API key entry consistent with other UI/API usage); unauthenticated calls fail as today.
- AC9: Typecheck, build, and a smoke route test for `GET /ui/board` pass.

## Notes

- Non-goals: AC builder, dependency graph, mobile-first polish, realtime multi-user presence.
- Design: `docs/superpowers/specs/2026-07-25-kanban-board-design.md`
- Next: `34-board-execution-control.spec.md`
