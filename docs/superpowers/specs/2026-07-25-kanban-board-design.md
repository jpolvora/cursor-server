# Design: Homelab Kanban Board (cards / specs / execution)

Date: 2026-07-25  
Status: approved (brainstorm)  
Delivery: layered specs `32` → `33` → `34`

## Goal

A UI dashboard that drives remote agent work on the homelab host: backlog Kanban of spec cards with **real** implementation status, Start/Pause/Finish from the card menu, backed by SQLite + filesystem working clones.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Card | Spec + optional active run (`active_run_id`) |
| Storage | SQLite (volume); FS clone for agent cwd; import/export `.spec.md` |
| Credentials | DB stores `secret_ref` (env/file name) only; host resolves token |
| Columns | Coarse lanes + exact step chip on card |
| Actions | Real Start/Pause/Finish + Start confirm (flow/flags/model) |
| Board scope | Global board + per-repo filter |
| UI | New `GET /ui/board`; keep `GET /ui/spec-editor` linked from cards |
| Lane moves | Manual drag only in Backlog/Refine/Ready; locked once run active |
| Approach | Three specs (data → UI → execution) |

## Architecture

```text
Browser (/ui/board)
    │  API key (existing auth)
    ▼
Board API (Hono) ── SQLite (cards, repos, secret refs, lane)
    │                    │
    │ export/import      │ resolve secret by name → env/file
    ▼                    ▼
{REPOS_ROOT}/{repo}/   git clone / reset working tree
  .agents/specs/         (agent cwd)
    │
    ▼
Existing execution: POST /tasks (async) · workflow-skills · harness · SSE stream
```

## Spec split

| Spec | Scope |
|------|--------|
| `32-board-data-plane.spec.md` | SQLite, repo registry, cards CRUD, ensure/cleanup clone, import/export |
| `33-board-ui.spec.md` | `/ui/board`, lanes, filters, card chrome, editor links |
| `34-board-execution-control.spec.md` | Start/Pause/Finish/Resume, lane lock, step→lane sync |

## Out of scope (epic)

- Postgres; encrypting raw tokens in DB
- Replacing or absorbing the Markdown spec-editor
- Multi-user presence; mobile-first polish
- OpenCode-specific column layouts
- Live SSE for board (polling MVP; stream reuse later)

## Related

- Existing: async tasks, run history, task streaming, workflow-skills agents, spec-editor
- PRD: `.agents/specs/index.PRD` Phase 4 + Next specs 32–34
