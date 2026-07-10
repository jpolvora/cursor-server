---
name: tdd-sdd-ddd-reviewer
description: Architectural audit (TDD, spec-driven design, layering) for cursor-server TypeScript/Hono backends. Use for layer-boundary and service-route separation reviews.
---

# TDD / SDD / DDD reviewer — cursor-server

Layer and design audit for this repo. Authoritative architecture: [senior-developer](../senior-developer/SKILL.md) + [AGENTS.md](../../../AGENTS.md).

## When to use

- Explicit architecture review request
- Large refactors touching routes + services
- Spec-driven feature planning validation

## Layer model

| Layer | Path | Allowed |
|-------|------|---------|
| Routes | `src/routes/` | HTTP, Zod parse, call services, return responses |
| Services | `src/services/` | Business logic, SDK, file system under REPOS_ROOT |
| Jobs | `src/jobs/` | Schedule registration, delegate to services |
| Config | `src/config.ts` | Env validation only |

**Forbidden:** routes calling `@cursor/sdk` directly; business logic in `index.ts` beyond wiring.

## Audit criteria

### TDD
- New behavior should have verification plan (typecheck/build/smoke; tests when runner exists)
- Bug fixes: regression step documented

### SDD
- Features trace to spec ACs when using us-workflow
- API changes reflected in README.md

### Layering
- No circular imports between routes and services
- Shared types colocated or in dedicated module — no "god" service

## Process

```bash
git diff main...HEAD -- src/
```

1. Map changed files to layers
2. Flag boundary violations
3. Compare to nearest peer file in same layer

See [REFERENCE.md](REFERENCE.md) for detailed checklist.

## Output

Markdown report: violations (Critical/Warning), suggested alignment, files to read as peers.
