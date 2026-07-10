# TDD / SDD / DDD — reference (cursor-server)

Read [senior-developer](../senior-developer/SKILL.md) first.

## Conventions

| Area | Rule |
|------|------|
| **Modules** | ESM; relative imports with `.js` extension |
| **HTTP** | Hono; thin route files |
| **Validation** | Zod in config and request parsing |
| **SDK** | `@cursor/sdk` only in services (or dedicated adapter) |
| **Errors** | Typed errors; safe HTTP mapping in routes |

## Backend audit

- **Async:** consistent `async/await`; no floating promises in route handlers
- **DI style:** pass `Config` into services/functions — avoid global env reads outside `config.ts`
- **File layout:** one route module per resource area (`health.ts`, `tasks.ts`)
- **Secrets:** never in source; validate required env at startup via Zod

## Anti-patterns

| Smell | Fix |
|-------|-----|
| Route file > ~150 lines with logic | Extract service |
| Direct `process.env` outside config | Centralize in `config.ts` |
| Agent created without disposal | `try/finally` or `await using` |
| Hardcoded `./repos/foo` | Use `REPOS_ROOT` from config |

## Verification

```bash
npm run typecheck
npm run build
```

Cite output in review.
