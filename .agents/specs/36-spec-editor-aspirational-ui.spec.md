---
id: null
slug: 36-spec-editor-aspirational-ui
title: "Spec-editor aspirational UI (AC builder, dependency graph, stage designer)"
source: local
specDate: 2026-07-26
status: completed
version: 0.1.0
---

# Specification — Spec-editor aspirational UI

## Description

Extend the MVP Markdown spec editor (`14-spec-editor`) with structured authoring aids: an acceptance-criteria builder, a dependency graph over specs/stages, and a stage designer aligned to QualifiedSpec frontmatter (`stages` / deps). Keep the Markdown source as the source of truth; UI tools edit/preview structured fields without replacing raw Markdown editing.

Depends on: `GET /ui/spec-editor`, QualifiedSpec parse/validate (`10`, fix `27`), stage orchestration (`12`).

## Acceptance Criteria

- AC1: AC builder lets authors add/reorder/edit acceptance criteria and round-trips into the Markdown (or frontmatter) body without losing free-form sections.
- AC2: Dependency graph visualizes spec↔spec and/or stage dependencies declared in frontmatter; invalid cycles or missing targets are surfaced.
- AC3: Stage designer edits the per-spec stage list (default omit `deploy`) and persists via existing validate/save APIs.
- AC4: MVP Markdown edit + validate + Save & Run remain available; aspirational panels are progressive enhancement, not a hard rewrite.
- AC5: Typecheck, build, and a smoke path for the enhanced editor route pass.
- AC6: Non-goals for v1: full IDE, collaborative multiplayer editing, replacing QualifiedSpec with a proprietary binary format.

## Notes

- Prefer thin client matching existing `/ui/*` serving style.
- Promote order: owner chose this ahead of WebSocket and Umbrel listing.
