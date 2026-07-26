---
id: null
slug: 27-fix-spec-schema-frontmatter-stages
title: "Fix QualifiedSpec frontmatter stages/dependencies parsing"
source: local
specDate: 2026-07-25
complexity: low
---

# Specification — Fix QualifiedSpec frontmatter stages/dependencies parsing

## Description

`parseSpecMarkdown` / QualifiedSpec validation ignores frontmatter `stages` and `dependencies` and hard-defaults stages. Spec `10-spec-schema` expects machine-actionable stage lists from the document. Error shape is plain `string[]` rather than structured items; YAML body path for AC3 is incomplete.

Parent verify: `10-spec-schema` score **7/10**. Evidence: `src/services/spec-schema.ts`.

## Acceptance Criteria

- AC1: When Markdown/YAML frontmatter includes `stages: […]`, those stages are used on the parsed `QualifiedSpec` (validated against allowed stage enum / strings).
- AC2: When frontmatter includes `dependencies` (or the project’s documented dependency field), they are preserved on the parsed object for harness consumers.
- AC3: When frontmatter omits `stages`, fall back to the **fixed** defaults from `26-fix-harness-default-stages` (do not invent a third list).
- AC4: Validation errors include path/field context (structured objects or Zod issue mapping), not only opaque strings — enough for the spec editor to highlight the bad field.
- AC5: Tests cover frontmatter stages override, missing stages → defaults, and at least one structured error; `npm run typecheck` / `npm run build` pass.

## Notes

- Prefer extending existing Zod schemas in `spec-schema.ts`.
- Full YAML-body alternate parser is optional if Markdown+frontmatter covers the editor MVP; if omitted, document the limitation in the step-08 result rather than claiming AC3 YAML complete.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #16 open). Not merged to develop/master yet.
