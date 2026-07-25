---
name: spec-format
description: >-
  Creates, reviews, or formats *.spec.md artifacts (local US/feature specification). Project-agnostic.
  Load when the user invokes /spec-format, @spec-format, "create spec", "review spec",
  "format spec" or requests validation of local specification format.
disable-model-invocation: true
version: 0.0.82
---

# spec-format

Create, review, or format `*.spec.md`. Canonical format SoT — other skills **reference** this skill; they do not duplicate frontmatter/sections. Schema: [`FORMAT.md`](FORMAT.md). Language: **en-us**.

## Modes

| Mode | When | Output |
|------|------|--------|
| **create** | Feature / tracker without local spec | New canonical `*.spec.md` |
| **review** | Gaps or format drift | Gap report + proposed fixes (edit only with approval) |
| **format** | Valid content, nonstandard shape | Reformatted file or proposed diff |

Infer mode or ask. Triggers: `/spec-format`, `@spec-format`, create/review/format/validate phrasing.

## Review (Done when report emitted; no edit without approval)

1. Read `*.spec.md` (or `{us-dir}/`).
2. Validate frontmatter, required sections, AC quality per [`FORMAT.md`](FORMAT.md).
3. Cross-check architecture docs when present (`CONTEXT.md`, stack file, `config.json.domain`).
4. Emit check table (Frontmatter / Description / ACs → OK|FAIL + fix).
5. Edit only on explicit `apply fixes` / `format`.

## Create (Done when path confirmed)

1. Collect title, description, ACs (or provider fetch).
2. GitHub issue → `github-provider` `fetch-to-spec`.
3. ADO WI → `azure-devops-provider` `fetch-to-spec`.
4. Existing hand-written `*.spec.md` → `local-spec-provider` register/normalize (no invented tracker fields).
5. Confirm canonical path with complete frontmatter + sections.

## Downstream

`spec-to-pr`, `ws-write-plan`, `ws-interview`, `ws-verify-plan`, `ws-testing` read **`{us-dir}/step-00-{slug}.spec.md`** only — never live tracker APIs or `*.issue.json`. See [`ARTIFACTS.md`](../spec-to-pr/ARTIFACTS.md).

Providers: [github-provider](../github-provider/SKILL.md) · [azure-devops-provider](../azure-devops-provider/SKILL.md) · [local-spec-provider](../local-spec-provider/SKILL.md). Hub: [`AGENTS.md`](../shared/AGENTS.md).
