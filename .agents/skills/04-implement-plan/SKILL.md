---
name: implement-plan
description: cursor-server code execution agent. Build mode implements a plan/DAG from coderPrompt and senior-developer guardrails; fix mode corrects findings from code-review, tests, or integration validation by defect class.
version: 1.1
disable-model-invocation: true
---

# implement-plan — cursor-server

Implements or fixes TypeScript code in `src/` following an execution plan. Two modes — declare explicitly when invoking.

## Modes

| Mode | When | Input |
|------|------|-------|
| **build** | New implementation from plan/DAG | `*.plan.exec.md` + `*.exec.dag.json` (one task/level) OR `*.plan.md` standalone |
| **fix** | Fix reported findings | Finding list (code-review, failed checks, integration report) |

If mode is unclear, ask before acting.

## Build mode

1. Read DAG task: `files[]`, `acceptance`, `coderPrompt`, `dependsOn`. Without DAG, read plan section "3. Step-by-step implementation".
2. Find an equivalent feature in the repo (`src/routes/`, `src/services/`, `src/jobs/`) and match its structure.
3. Implement strictly per `coderPrompt`/`files[]` — no extra files without justification.
4. Priority order:
   - [`AGENTS.md`](../../../AGENTS.md) — routing and SDK patterns
   - [`senior-developer`](../senior-developer/SKILL.md) — thin routes, Zod, SDK disposal
   - [`karpathy-guidelines`](../karpathy-guidelines/SKILL.md) — surgical changes
   - [`stack.md`](../../us-workflow/stack.md) — verification commands
5. Run before reporting success:
   - `npm run typecheck`
   - `npm run build`
   - Manual smoke (`curl /health`, affected endpoints) when routes change
6. Report `files_touched` (created/modified/deleted).

## Fix mode

1. Read [`karpathy-guidelines`](../karpathy-guidelines/SKILL.md).
2. For each confirmed finding, grep for sibling occurrences — fix the **defect class**, not only the cited line.
3. Re-run typecheck + build.
4. Document: problem, fix, siblings found, verification output.

## Output (both modes)

- Code in working tree (no commit — caller owns commit gates).
- Summary: files touched, checks run, risks.

## step-output (workflow subagent)

```yaml
status: success | partial | failed | needs_user
files_touched:
  created: []
  modified: []
  deleted: []
verification:
  files_on_disk: pass | fail
  build: pass | fail | skipped
  tests: pass | fail | skipped
summary: |
  <text>
```

## Conduct

- **Never commit or push** unless caller explicitly authorizes.
- **Minimal diff** — no drive-by refactors.
- **Stop and ask** if `coderPrompt` is ambiguous (`needs_user` when dispatched).

## Triggers

- `@[implement-plan] us-1234.plan.md` (build, standalone)
- `@[implement-plan] "fix the 3 findings below: ..."` (fix)
- `us-workflow` Step 5 (build), Step 10 (fix)
