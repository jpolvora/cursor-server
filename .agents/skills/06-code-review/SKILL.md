---
name: us-code-review
description: Step 9 reviewer for us-workflow (cursor-server). Rigorous local branch review vs main with two-phase triage, evidence proof, defect-class generalization, and single-round completeness. Distinct from standalone code-review skill.
version: 2.1
disable-model-invocation: true
---

# Code Reviewer Skill — cursor-server (Step 9)

Senior code reviewer — local PR/CI simulation with two-phase analysis and structured evidence.

## Anti-loop mandate

- **Precision:** report only provable findings.
- **Completeness:** all material findings in **one round**.
- **Class, not instance:** grep sibling occurrences of each confirmed defect.

Target: one round → full list or **"No feedback"**.

## Phase 0 — Stack detection

**cursor-server:** `package.json` + `src/index.ts` + Hono + `@cursor/sdk`.

Load [`AGENTS.md`](../../../AGENTS.md) and [`senior-developer`](../senior-developer/SKILL.md).

Review scope per [`stack.md`](../../us-workflow/stack.md) § Code Review Diff Scope.

Ignore: `dist/`, `node_modules/`, harness-only `*.md` unless explicitly in scope.

## Phase 0.5 — Diff

```bash
git branch --show-current
git diff --name-status main...HEAD -- \
  'src/**' 'package.json' 'tsconfig.json' \
  ':!dist/**' ':!node_modules/**'
git diff main...HEAD -- "path/to/file"
```

Use `master` if `main` does not exist.

## Phase 1 — Triage

Hypotheses anchored on changed lines only. Skip nits, style, untouched legacy.

For `src/routes/` and `src/services/`: SDK misuse, missing validation, secret leaks, path traversal on `repo`, missing agent disposal.

## Phase 2 — Investigation

Four-step proof per candidate:
1. Evidence read
2. Executable failure scenario
3. Missing protection confirmed
4. Alternatives rejected

Cannot prove → discard.

### 2.5 Generalization

For each confirmed finding, grep sibling pattern in diff scope.

## Severity

| Level | Examples |
|-------|----------|
| **Critical** | Secret leak, unsafe repo path, missing SDK disposal, auth bypass |
| **Warning** | Layer violation, weak error handling, missing Zod on new input |
| **Suggestion** | Naming, minor clarity |

## Output format

```markdown
## Code review (us-workflow Step 9)

**Branch:** `…`
**Base:** main
**Files reviewed:** N

### Critical
- **path:line** — finding → fix

### Warning
- …

### Suggestion
- …

---
**Verdict:** No feedback | N findings (apply via implement-plan fix mode)
```

## Verification reminder

After fixes: `npm run typecheck`, `npm run build` — cite output.

## References

- [`code-review`](../code-review/SKILL.md) — shared guardrails
- [`senior-developer`](../senior-developer/SKILL.md)
- [`karpathy-guidelines`](../karpathy-guidelines/SKILL.md)
