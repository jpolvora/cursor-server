---
id: null
slug: 26-fix-harness-default-stages
title: "Fix harness default stages (drop unsupported deploy default)"
source: local
specDate: 2026-07-25
complexity: low
---

# Specification — Fix harness default stages (drop unsupported deploy default)

## Description

Default `QualifiedSpec.stages` is `["implement", "build", "test", "deploy", "review"]` while Cursor/OpenCode/Hermes runners reject or do not support `deploy` as a real stage. A happy-path harness run with defaults therefore self-fails on `deploy`. Spec `12-stage-orchestration` AC1 also expects a pipeline that includes `spec` → … → `review`; defaults omit `spec` and include unsupported `deploy`.

Parent verify: `12-stage-orchestration` score **6/10**. Evidence: `src/services/spec-schema.ts` default stages.

## Acceptance Criteria

- AC1: Change the default stages list used when a spec does not declare stages to a runnable set supported by the default Cursor SDK runner (recommended: `["implement", "build", "test", "review"]`, or include `"spec"` only if `LocalCursorRunner` / default runner implements it).
- AC2: Do **not** include `"deploy"` in defaults unless a registered default runner supports it; `deploy` may remain a valid optional stage when explicitly declared and a supporting runner is selected.
- AC3: Orchestrator still runs declared stages sequentially and stops/fails clearly on unsupported stage + runner combinations (existing behavior).
- AC4: Update unit tests that assert the old default list; add a test that default pipeline stages are all in the default runner’s `supportedStages`.
- AC5: `npm run typecheck` and `npm run build` pass.

## Notes

- Coordinate with `27-fix-spec-schema-frontmatter-stages` if both run: defaults vs explicit frontmatter.
- Update any docs that show the old default list.

## Delivery status

- Batch `ms-20260726T004403Z`: worker reported **shipped** (PR #15 open). Not merged to develop/master yet.
