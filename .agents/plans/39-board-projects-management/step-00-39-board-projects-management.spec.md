---
id: null
slug: 39-board-projects-management
title: "Kanban board projects management (CRUD, config, modals, list)"
source: local
specDate: 2026-07-26
status: draft
version: 0.1.0
---

# Specification — Kanban board projects management

## Description

Add first-class **projects** management on the homelab Kanban board (`GET /ui/board` and related `/board/*` APIs). Operators must list projects, create/read/update/delete them, and edit project configuration through modal dialogs (not page navigations for create/edit).

Builds on the Phase 4 board (`32`–`34`). Spec `32` already persists board **repos**; this feature either maps projects onto that model with a clear projects UX, or introduces a thin projects layer that owns configuration while cards stay repo-scoped. Prefer reusing the existing SQLite board DB and auth patterns. Secrets stay out of the DB (`secret_ref` only), consistent with `32`.

Out of scope: changing lane/execution semantics from `34`; agent prompt widget changes (`35`); new harness runners.

## Acceptance Criteria

- AC1: Authenticated API supports project CRUD (create, get, list, update, delete) with stable ids and validation errors (400/404/409 as appropriate).
- AC2: Project list endpoint returns a paginated or complete list suitable for the board UI (id, name, key config summary fields, timestamps); empty list is valid.
- AC3: Project configuration fields are editable (at minimum: display name plus clone/remote and `secret_ref` or equivalent wiring to the existing board repo model); responses never leak resolved secret values.
- AC4: Board UI shows a projects list (entry point from `/ui/board` or a dedicated projects panel) with create and open/edit actions.
- AC5: Create and edit use modal dialogs (not full-page forms); cancel discards unsaved changes; save persists via the API and refreshes the list.
- AC6: Delete requires an explicit confirm step in the modal/UI and removes the project (or soft-blocks when cards still reference it with a clear 409/error).
- AC7: Typecheck, build, and route/UI-focused tests cover CRUD happy path plus auth rejection; no real remotes required in CI.

## Notes

- Depends on: `32-board-data-plane`, `33-board-ui` (extend), client auth; preferably hosted in the Projects pane of `40-main-page-dashboard`.
- Design reference: `docs/superpowers/specs/2026-07-25-kanban-board-design.md` (extend; do not contradict repos/secret_ref rules).
- Clarify during plan whether "project" is an alias UX for board repos or a new parent entity.
