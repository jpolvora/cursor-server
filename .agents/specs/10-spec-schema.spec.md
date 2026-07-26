---
id: null
title: Machine-Actionable Spec Schema & Validator
slug: spec-schema
source: local
specDate: 2026-07-25
status: completed
version: 0.1.0
---

# Machine-Actionable Spec Schema & Validator

## Description
Define and implement the machine-actionable **Qualified Specification Schema** for Phase 3's flagship pipeline harness (`implement → build → test → deploy → review`). Provide a Zod validator and parser service to load, validate, and query structured specifications from Markdown (frontmatter + structured blocks) or JSON/YAML specs.

---

## Acceptance Criteria

### AC1: Qualified Spec Schema Definition
- **Given** a spec file submitted to `cursor-server`,
- **When** parsed by the `SpecSchema` validator,
- **Then** it conforms to a strict TypeScript/Zod schema containing:
  - `id`: Unique string slug or UUID.
  - `title`: Short descriptive title.
  - `version`: Version identifier (e.g. `1.0.0`).
  - `stages`: Array of defined execution stages (default `["implement", "build", "test", "deploy", "review"]` or custom subset).
  - `acceptanceCriteria`: Array of items with `id` (e.g. `AC1`), `title`, `given`, `when`, `then`, and target `verificationStage`.
  - `dependencies`: Optional array of prerequisite spec IDs or task preconditions.

### AC2: Markdown Frontmatter + Block Parser
- **Given** a `.spec.md` file formatted with YAML frontmatter and structured GitHub-flavored Markdown headers,
- **When** `parseSpecMarkdown(content)` is called,
- **Then** it extracts frontmatter metadata and structured acceptance criteria into a strongly typed `QualifiedSpec` object without loss of section detail.

### AC3: Spec Validation Endpoint & Service
- **Given** an API call to `POST /specs/validate` with raw Markdown, JSON, or YAML spec content,
- **When** the payload is processed,
- **Then** it returns `{ valid: true, spec: QualifiedSpec }` or `{ valid: false, errors: ZodErrorItem[] }` with HTTP status `200` or `400`.

### AC4: Spec Repository Storage and Querying
- **Given** valid specs saved under `{REPOS_ROOT}/{repo}/.cursor/specs/` or `.agents/specs/`,
- **When** `GET /repos/:repo/specs` is called,
- **Then** it lists all valid qualified specs, their current validation status, and summary metadata.

---

## Notes & Technical Guidance
- Build strictly using Zod (`z.object({ ... })`) in `src/services/spec-schema.ts`.
- Ensure backwards compatibility with existing human-authored markdown specs.
