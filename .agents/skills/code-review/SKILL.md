---
name: code-review
description: >
  Rigorous local PR/branch review for cursor-server (TypeScript, Hono, @cursor/sdk).
  Diff against main; SDK patterns, route/service boundaries, env secrets, tests, clean code.
  Include markdown when the review targets docs, AGENTS.md, skills, or README.md.
---

# Code review — cursor-server

Branch vs **`main`** (or `master`). Catch bugs, secret leaks, SDK misuse, and pattern drift before push.

Load [senior-developer](../senior-developer/SKILL.md) for engineering guardrails.

## Scope

### Review unit (not diff hunks only)

1. Every **file changed in the branch diff** → read and review the **entire file** at branch tip.
2. **Referenced files** (one hop): imports, called services, config schema, paired tests.
3. Do **not** expand to unrelated modules.

**Exclude:** `dist/`, `node_modules/`, lockfile noise unless intentional. Uncommitted-only: `git diff` / `git diff --cached`.

**Include:** `src/**/*.ts`, `package.json`, `tsconfig.json`, harness `*.md`.

## cursor-server guardrails

- **SDK:** local runtime; agent disposal; distinguish startup vs run errors; log `agentId` / `runId`.
- **Routes:** thin handlers; Zod validation; no business logic in routes.
- **Secrets:** env only; no keys in logs or responses.
- **Repos:** resolve `{REPOS_ROOT}/{repo}`; no hardcoded absolute paths.
- **Roadmap:** flag scope creep into unapproved features (Docker, auth, job queue, spec harness).

## Project pattern conformance

| Area | Expect |
|------|--------|
| **Layers** | routes → services → SDK/config |
| **Validation** | Zod for env and request bodies |
| **Errors** | Clear operator messages; safe client responses |
| **ESM** | `.js` extensions in relative imports |
| **Style** | Minimal scope; match existing Hono patterns |

Optional deep dives: [tdd-sdd-ddd-reviewer](../tdd-sdd-ddd-reviewer/SKILL.md); [security-review](../security-review/SKILL.md) (OWASP, API security).

## Process

```bash
git branch --show-current
git diff --name-status main...HEAD
git diff main...HEAD -- path/to/file
```

Harness/doc reviews: check duplicate rules across `AGENTS.md`, skills, `README.md`.

## Response format

Default: **English** unless user asks otherwise.

Nothing to fix → **No feedback**

```markdown
## Code review (branch vs main)

**Branch:** `…`
**Files reviewed:** N (changed + referenced)

### Critical (security, SDK, bugs)
- **path:** issue → suggested fix

### Project patterns
- **path:** deviation → align with peer / skill

### Clean code / maintainability
- **path:** issue → suggestion

### Tests / verification
- Missing checks or commands not run → what to add/run

---
**Apply fixes?** (Reply YES — then `npm run typecheck`, `npm run build`.)
```

## After YES

Agreed fixes (karpathy) → `npm run typecheck` → `npm run build`. Cite fresh output.

## Do not

Contradict [senior-developer](../senior-developer/SKILL.md) or [AGENTS.md](../../../AGENTS.md); whole-repo refactors; ignore harness `*.md` when requested.
