---
name: typescript-security-review
description: TypeScript/Node security and performance review for cursor-server — auth, env secrets, API input validation, SDK usage, and path safety. Use when auditing backend routes and services.
---

# TypeScript security & performance review — cursor-server

Focused review for `src/` — complement to [security-review](../security-review/SKILL.md) OWASP checklist.

Load [senior-developer](../senior-developer/SKILL.md) for project invariants.

## Scope triggers

- New/changed routes (`src/routes/`)
- SDK integration (`src/services/agent-runner.ts` and siblings)
- Env/config changes (`src/config.ts`)
- Job handlers (`src/jobs/`)

## Security checklist

| Area | Check |
|------|-------|
| **Secrets** | No `CURSOR_API_KEY` in logs, responses, or git |
| **Input validation** | Zod on request bodies and env |
| **Path traversal** | `repo` name sanitized; resolve only under `REPOS_ROOT` |
| **SSRF** | No user-controlled URLs in server-side fetches without allowlist |
| **Error leakage** | Client errors safe; operator logs sufficient |
| **Auth** | When added: fail closed; no anonymous access to task endpoints unless designed |
| **Dependencies** | No unnecessary packages; pin major SDK versions intentionally |

## SDK checklist

- Local runtime unless cloud explicitly required
- `settingSources: []` unless intentional
- Agent disposal on all paths (try/finally or `await using`)
- Distinguish `CursorAgentError` vs run `status === "error"`

## Performance (proportionate)

- Avoid blocking the event loop on long agent runs without async design
- Cron jobs: no overlapping heavy work without guard
- Do not add caching/queue prematurely — match project minimal scope

## Output

Fold findings into parent review report (Critical/Warning) — not a separate 4-section template unless standalone.

## References

- [security-review/languages/javascript.md](../security-review/languages/javascript.md)
- [security-review/references/api-security.md](../security-review/references/api-security.md)
- [AGENTS.md](../../../AGENTS.md)
