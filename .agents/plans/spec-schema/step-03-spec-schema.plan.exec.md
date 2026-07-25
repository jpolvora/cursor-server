# Execution DAG - spec-schema

## Tasks

### Task 1: Create Spec Schema Service (`src/services/spec-schema.ts`)
- Define Zod schemas for Acceptance Criteria and Qualified Spec.
- Implement Markdown parser (`parseSpecMarkdown`) for YAML frontmatter & Given/When/Then sections.
- Implement spec validator (`validateSpecPayload`).
- Implement directory scanner (`listRepoSpecs`).

### Task 2: Create Spec API Routes (`src/routes/specs.ts` & `src/index.ts`)
- Implement `POST /specs/validate` endpoint.
- Implement `GET /repos/:repo/specs` endpoint.
- Register routes in `src/index.ts`.

### Task 3: Unit Testing (`src/services/spec-schema.test.ts`)
- Add unit tests for schema validation, Markdown parsing, and error handling.
- Verify `npm run typecheck` and `npm run build`.
