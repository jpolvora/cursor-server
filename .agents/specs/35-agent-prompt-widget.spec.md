---
id: null
slug: 35-agent-prompt-widget
title: "Agent prompt / TUI widget (OpenCode-like, simpler)"
source: local
specDate: 2026-07-26
status: completed
version: 0.1.0
---

# Specification — Agent prompt / TUI widget

## Description

Add a minimal, effective prompt surface (browser UI inspired by OpenCode’s command-palette TUI, not a full terminal clone) so operators can talk directly to an agent on the homelab host: submit prompts, pick repo/agent role, watch task status/output, and query recent tasks. Ship as a reusable widget that can stand alone (`GET /ui/prompt` or similar) and embed into existing UIs (board, spec-editor) when the user needs a quick agent loop without leaving the page.

Simpler than OpenCode: no full agent marketplace, fuzzy file attach, or multi-pane TUI. Focus on prompt → `POST /tasks` → poll / SSE stream → readable output.

Depends on: existing task API (`POST /tasks`, `GET /tasks`, `GET /tasks/:id/stream`, `GET /agents`), auth patterns used by other UIs. Optionally embeds into board after `33` / `34`; standalone route does not require Kanban.

## Acceptance Criteria

- AC1: A served HTML page (or embeddable fragment) exposes a centered prompt input with repo selector, optional agent role, and submit.
- AC2: Submit creates an async task via existing `POST /tasks` (API key handling consistent with `/ui/spec-editor`).
- AC3: UI shows task status and streams or polls output until done/failed (prefer existing SSE when available).
- AC4: Operator can list/query recent tasks for the selected repo (or global) and reopen a task’s output.
- AC5: Widget is reusable: standalone route works alone; documented hook points exist to mount the same UI inside board or another page without duplicating task logic.
- AC6: Non-goals stay out of v1: full OpenCode TUI parity, `@` fuzzy file attach, multi-agent tabs, WebSocket transport, cloud runtime.
- AC7: Typecheck, build, and a smoke route test for the new UI path pass.

## Notes

- Inspiration: OpenCode home prompt (ask anything, agent/model footer, shortcuts) — keep visual/UX sparse and effective.
- Prefer thin client over new frameworks; match `/ui/spec-editor` serving style unless board already established a shared UI kit.
- Next after Phase 4 board (`32`–`34`) unless owner prioritizes standalone prompt earlier.
