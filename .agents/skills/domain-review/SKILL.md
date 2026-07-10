---
name: domain-review
description: >
  Module-area review for cursor-server src/ (routes, services, jobs, config).
  Use for /domain-review, module audit, smells, security, and layer-boundary checks.
  Also supports next/auto rotation across module areas.
---

# Module review — cursor-server

On-demand Layer 2 review by **code area**, not PR diff. For branch/PR review use [code-review](../code-review/SKILL.md). OWASP depth → [security-review](../security-review/SKILL.md).

**TypeScript security:** [typescript-security-review](../typescript-security-review/SKILL.md) on every review touching `src/`.

## Module catalog

| Slug | Path | Focus |
|------|------|-------|
| `routes` | `src/routes/` | Thin handlers, Zod, status codes, no business logic |
| `services` | `src/services/` | SDK patterns, disposal, errors, repo path resolution |
| `jobs` | `src/jobs/` | Cron safety, idempotency, error logging |
| `config` | `src/config.ts`, `src/index.ts` | Env schema, wiring, no secret defaults |

Track last review in [REPORT.md](REPORT.md) per module. **`auto` pipeline:** [AUTO.md](AUTO.md).

## Parse

```
/domain-review [<slug>] [next] [auto] [dry-run]
```

| Token | Effect |
|-------|--------|
| `<slug>` | Select module from catalog |
| `next` | Pick never-reviewed first, else oldest review date |
| `auto` | Apply Critical/Warning fixes → verify → commit → push → PR → [goal-fix-pr](../09-goal-fix-pr/SKILL.md) |
| `dry-run` | With `auto`: no git writes |

## Iron rules

1. **Select module before investigating.**
2. **One perimeter** — listed paths only.
3. **Report:** Critical + Warning table, fix plan ([REPORT.md](REPORT.md)).
4. **No implement** until user asks — except `auto`.
5. **Stamp** review date after report.

## Workflow

1. Announce module + paths
2. Read module files at HEAD
3. Apply [senior-developer](../senior-developer/SKILL.md) + [typescript-security-review](../typescript-security-review/SKILL.md)
4. Write report; stamp `## Última revisão` / `Last reviewed`
5. `auto` → fix → `npm run typecheck` → `npm run build` → PR cycle

## References

- [AGENTS.md](../../../AGENTS.md)
- [AUTO.md](AUTO.md) — auto fix/PR flow
- [REPORT.md](REPORT.md) — report template
