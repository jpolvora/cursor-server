---
id: null
slug: 32-board-data-plane
title: "Board data plane (SQLite cards, repos, import/export)"
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Specification — Board data plane (SQLite cards, repos, import/export)

## Description

Introduce a SQLite-backed data plane for the homelab Kanban board. Persist **repos** (local name, remote URL, secret reference, clone path) and **cards** (spec markdown + coarse lane + optional active run id). Agent work still runs in a filesystem git clone under `REPOS_ROOT`; empty or corrupt clones can be cleaned and re-cloned from the stored remote. Cards support import/export to `.agents/specs/*.spec.md` on that clone. Secrets are never stored in the database: only a `secret_ref` (env var or file name) that the server resolves at clone/push time.

Depends on: client auth, repo validation patterns, existing `REPOS_ROOT`. Does **not** include board HTML UI or Start/Pause/Finish execution wiring (see specs 33 and 34).

## Acceptance Criteria

- AC1: SQLite database file is configurable via env (e.g. `BOARD_DB_PATH`), lives on a persistent volume path, and is created/migrated on startup.
- AC2: `repos` table supports CRUD via authenticated `/board/repos` APIs with fields: `name`, `remote_url`, `secret_ref`, optional `local_path` (default `{REPOS_ROOT}/{name}`).
- AC3: API responses and logs never include resolved secret values; only `secret_ref` names are returned.
- AC4: `POST /board/repos/:id/ensure-clone` creates the working tree if missing/empty by cloning `remote_url` using the resolved `secret_ref`; `POST /board/repos/:id/cleanup-clone` deletes the local working tree but keeps the DB row.
- AC5: Unresolved or missing `secret_ref` yields HTTP 400 with a safe error; clone failures do not leak credentials.
- AC6: `cards` table stores `repo_id`, `title`, `spec_markdown`, `lane`, optional `workflow`, optional `active_run_id`, `step_label`, `sort_order`, timestamps.
- AC7: Authenticated card CRUD via `/board/cards` supports list filters `repoId` and `lane`; new cards default to `lane=backlog`.
- AC8: `POST /board/cards/:id/move` allows lane changes only among planning lanes (`backlog`, `refine`, `ready`, and `blocked` when no active run); returns 409 when `active_run_id` is set.
- AC9: Import from filesystem creates/updates cards from `{clone}/.agents/specs/*.spec.md`; export writes card `spec_markdown` to safe filenames under that directory (path traversal rejected).
- AC10: Import/export validate spec shape via existing spec-schema helpers where applicable; invalid specs return 422 with validation details.
- AC11: Typecheck, build, and unit/route tests pass (temp SQLite + temp dirs; no real remotes required in CI).

## Notes

- Design: `docs/superpowers/specs/2026-07-25-kanban-board-design.md`
- Next: `33-board-ui.spec.md`, then `34-board-execution-control.spec.md`
- Coarse lanes: `backlog` | `refine` | `ready` | `implementing` | `review` | `ship` | `done` | `blocked` | `paused`
