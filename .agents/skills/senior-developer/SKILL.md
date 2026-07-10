---
name: senior-developer
description: >
  Senior TypeScript / Node engineering standards for cursor-server: thin Hono routes,
  Zod validation, @cursor/sdk local runtime, service-layer logic, and project conventions.
  Tests for every new feature, regression coverage for bug fixes, code-review proof before completion,
  docs sync when API or behavior changes (see DOCS-SYNC.md),
  and read/write of learned knowledge in MEMORY.md (pre-read before implement; append via learning on completion).
  Load with gabarito, karpathy-guidelines, and caveman per AGENTS.md § Skill loading.
  Apply on every task in this repository.
---

# Senior Developer — cursor-server

**Auto-activated every response** unless the user opts out in-thread (`skip senior-developer`). **Load order:** [AGENTS.md](../../../AGENTS.md) § Skill loading. Karpathy wins on diff size; this skill wins on cursor-server architecture.

## Session marker (first reply only)

Openers, opt-outs, precedence: [AGENTS.md](../../../AGENTS.md) § Skill loading and § Precedence. Apply implicitly; do not lecture about the marker.

## Learned knowledge ([MEMORY.md](../../../MEMORY.md))

**Read before you implement.** Root `MEMORY.md` is the cross-session log of decisions and pitfalls ([learning](../learning/SKILL.md) appends on completion). Before new features, bug fixes, or non-trivial refactors:

1. **Grep or skim** entries related to the task — routes, SDK, scheduler, env, deployment, etc.
2. **Apply** recorded decisions and helpers.
3. **Avoid** mistakes already documented.

| Phase | Action |
|-------|--------|
| Session start / task kickoff | Read task-related `MEMORY.md` entries |
| Stuck or repeating a failure | Re-check `MEMORY.md` for the same symptom |
| Task complete | Append new insight via [learning](../learning/SKILL.md); cite in proof `**Learning:**` line |

Q&A with no implementation: pre-read optional; completion still uses `Learning: N/A` when nothing new was learned.

## Stack

| Layer | Path | Role |
|-------|------|------|
| Entry | `src/index.ts` | Hono app, wires routes + scheduler |
| Config | `src/config.ts` | Zod env validation |
| Routes | `src/routes/` | HTTP handlers — thin, no business logic |
| Services | `src/services/` | Agent runs, domain logic |
| Jobs | `src/jobs/` | node-cron registration |

**Node 20+**, ESM. Read [AGENTS.md](../../../AGENTS.md) for SDK patterns and roadmap boundaries.

## SDK & agent runs

- **Local runtime only** unless explicitly designing a cloud feature:

```typescript
local: { cwd: repoPath, settingSources: [] }
```

- Always dispose agents (`await using` or `finally` + `[Symbol.asyncDispose]()`).
- Distinguish `CursorAgentError` (startup) from `result.status === "error"` (run failed after start).
- Log `agentId` and `run.id` after `send()` in production paths.
- Resolve target repos as `{REPOS_ROOT}/{repo}` — never hardcode absolute paths in routes.

## HTTP & validation

- **Hono:** keep handlers thin; validate with Zod; return appropriate status codes.
- **Secrets:** `CURSOR_API_KEY` and env vars only — never commit or log secrets.
- **Errors:** clear messages for operators; do not expose internal paths or keys to clients.

## Testing (mandatory)

Full policy: [TESTING.md](TESTING.md). Summary: feature → add test when framework exists; bug fix → regression test + run `npm run typecheck` / `npm run build` this session; never delete tests to silence failures.

## Code review proof (before “done”)

```markdown
## Code review proof

**Scope:** …
**Karpathy check:** …
**SDK / routes / env:** …
**Tests:** [files; regression name if bug fix; `npm run typecheck` / `npm run build` — result]
**Docs sync:** [README.md / AGENTS.md updated] | N/A — see [DOCS-SYNC.md](DOCS-SYNC.md)
**Learning:** [MEMORY.md entry title] | N/A — see [learning](../learning/SKILL.md)
**Changelog:** [CHANGELOG.md entry] | N/A — see [changelog](../changelog/SKILL.md)
**Findings fixed:** …
**Residual risk:** … (optional)
```

Checklist: lines trace to request; SDK disposal; env/secrets; typecheck/build run this session; [learning](../learning/SKILL.md) and [changelog](../changelog/SKILL.md) when applicable.

Escalate multi-file work to code-reviewer subagent when available.

## Docs sync

When API, env vars, deployment, or behavior change: [DOCS-SYNC.md](DOCS-SYNC.md) — same session, proof line required.

## Do not

- Switch to cloud runtime without explicit requirement.
- Add large frameworks or ORMs for the initial API surface.
- Implement roadmap items (Docker Compose, spec editor, Hermes) without owner go-ahead.
- Put business logic in route handlers.
- Start implementation without checking task-related [MEMORY.md](../../../MEMORY.md) entries.
- Complete without Karpathy + verification + proof + [learning](../learning/SKILL.md).
- Fix bugs via chat rules instead of code.
