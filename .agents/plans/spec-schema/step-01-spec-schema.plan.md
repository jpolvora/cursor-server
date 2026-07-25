# Implementation Plan - Machine-Actionable Spec Schema & Validator

## Goal
Implement the machine-actionable **Qualified Specification Schema** (`spec-schema`) for `cursor-server`, enabling pipeline harness stages to validate, parse, and query structured specifications from Markdown or JSON payloads.

---

## User Review Required
> [!NOTE]
> Backwards compatibility is preserved for existing Markdown specifications. Non-conforming Markdown files will parse with default fallback IDs/stages rather than throwing internal errors.

---

## Proposed Changes

### Core Service & Schema Definition

#### [NEW] [spec-schema.ts](file:///l:/source/cursor-server/src/services/spec-schema.ts)
- Define `AcceptanceCriterionSchema` and `QualifiedSpecSchema` using `zod`.
- Implement `parseSpecMarkdown(content: string): QualifiedSpec` to parse YAML frontmatter and extract Gherkin-style Given/When/Then criteria from Markdown headers.
- Implement `validateSpecPayload(input: unknown)` to handle stringified JSON/YAML/Markdown or structured objects.
- Implement `listRepoSpecs(repoPath: string)` to scan `{REPOS_ROOT}/{repo}/.cursor/specs` and `.agents/specs/`.

### API Routes

#### [NEW] [specs.ts](file:///l:/source/cursor-server/src/routes/specs.ts)
- `POST /specs/validate`: Accepts spec content/object, validates via `validateSpecPayload`, returns `{ valid: true, spec }` or `{ valid: false, errors }`.
- `GET /repos/:repo/specs`: Resolves repo path using `validateRepoPath`, scans for specs via `listRepoSpecs`, and returns specs summary array.

#### [MODIFY] [index.ts](file:///l:/source/cursor-server/src/index.ts)
- Mount `specsRouter` under `/specs` and `/repos`.

### Testing

#### [NEW] [spec-schema.test.ts](file:///l:/source/cursor-server/src/services/spec-schema.test.ts)
- Test Markdown parsing of frontmatter & Given/When/Then criteria.
- Test valid and invalid spec payloads via Zod validation.
- Test `listRepoSpecs` directory scanning logic.

---

## Verification Plan

### Automated Tests
- Run `npm run typecheck`
- Run `npm test` / `node --test` suite if available, or dedicated ts-node script.
- Run `npm run build`
- Run `npm run scan-secrets`

### Manual Verification
- Curl `POST /specs/validate` with valid spec markdown content and verify JSON response.
- Curl `GET /repos/:repo/specs` to verify spec listing.
