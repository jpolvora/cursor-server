---
id: null
slug: board-execution-control
title: "Board execution control (Start / Pause / Finish / status sync)"
source: local
specDate: 2026-07-25
status: draft
version: 0.1.0
---

# Specification — Board execution control (Start / Pause / Finish / status sync)

## Description

Wire Kanban card menu actions to real homelab execution. **Start** confirms workflow (`full` = `spec-to-pr`, `lite` = `spec-to-pr-lite`), flags, and model; ensures clone; exports the card spec to the repo filesystem; enqueues an async task/run; sets `active_run_id` and leaves planning lanes. While a run is active, coarse `lane` and `step_label` sync from real task/workflow progress (full steps 0–9 / F0–F6 and lite steps 0–5). **Pause** pauses/cancels the worker per existing pause semantics and sets lane `paused` while keeping `active_run_id` for **Resume**. **Finish** is a confirmed close: cancel if still running, clear `active_run_id`, move to `done`. Failed runs without Finish remain observable as `blocked` (or last mapped lane with a failed status pill).

Depends on: `32-board-data-plane`, `33-board-ui`, async task queue, workflow-skills agents, optional task streaming for later enhancement.

## Acceptance Criteria

- AC1: `POST /board/cards/:id/start` accepts `{ workflow: "full"|"lite", flags?, model? }`, requires confirmation semantics in UI, returns 409 if a run is already active.
- AC2: Start ensures clone (or fails safely), exports card `spec_markdown` to the repo `.agents/specs/` path, enqueues execution via existing async task path using `spec-to-pr` or `spec-to-pr-lite` agent, and sets `active_run_id`, `workflow`, and an initial non-planning `lane`.
- AC3: While `active_run_id` is set, `POST /board/cards/:id/move` remains rejected with 409; lane updates come from status sync only (plus Pause/Finish/Resume).
- AC4: Status sync maps full and lite progress to coarse lanes and updates `step_label` (e.g. implement-ish steps → `implementing`, review → `review`, ship/fix-pr → `ship`).
- AC5: `POST /board/cards/:id/pause` requests pause/cancel on the active worker, sets `lane=paused`, keeps `active_run_id` for resume.
- AC6: Resume (menu or start-resume path) continues the paused run without creating a duplicate conflicting `active_run_id`.
- AC7: `POST /board/cards/:id/finish` requires explicit confirm; cancels an in-flight run if needed; clears `active_run_id`; sets `lane=done`.
- AC8: Failed runs without Finish are visible as `blocked` and/or a failed status pill; Finish still allowed to close to `done`.
- AC9: `GET /board/cards/:id/status` returns card fields plus mirrored run/step summary for the UI poller.
- AC10: Errors for missing secret, clone failure, and conflict cases match data-plane safe messaging (no token leak).
- AC11: Route/unit tests cover Start/Pause/Resume/Finish state machine with mocked runner/queue; typecheck and build pass.

## Notes

- UI Start dialog: workflow, flags (`auto`, `dry-run`, etc. as supported by agents), model.
- SSE live board updates are optional follow-up; polling is enough for MVP.
- Design: `docs/superpowers/specs/2026-07-25-kanban-board-design.md`
