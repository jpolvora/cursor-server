---
id: 14-spec-editor
title: Served Spec Editor & Interactive Environment
slug: 14-spec-editor
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Served Spec Editor & Interactive Environment

## Description
Provide a hosted, web-based specification editor and environment served directly by `cursor-server`. Authors can create, edit, validate, and preview machine-actionable `.spec.md` files visually. The editor features real-time Zod schema validation, acceptance criteria builder UI, stage configuration, dependency graph visualization, and direct one-click triggering of harness runs against target repositories.

---

## Acceptance Criteria

### AC1: Hosted Editor UI Serving
- **Given** `cursor-server` is running,
- **When** a browser accesses `GET /ui/spec-editor`,
- **Then** the server serves an interactive web UI allowing spec browsing, editing, and authoring.

### AC2: Real-Time Spec Schema Validation
- **Given** an author editing frontmatter or acceptance criteria in the editor,
- **When** changes are made,
- **Then** the editor performs client-side or API validation via `POST /specs/validate` and highlights schema errors or missing mandatory fields.

### AC3: Spec Storage & Execution Triggering
- **Given** a spec opened or created in the editor,
- **When** the author clicks "Save & Run",
- **Then** the spec is saved to the repo's `.agents/specs/` directory and dispatches a new stage pipeline run via `POST /harness/runs`.

---

## Technical Guidance & Architecture
- Serve UI via static HTML/JS bundle or light Hono template routes under `/ui`.
- Use `spec-schema.ts` endpoints for live spec validation.
