---
name: multi-domain-review
description: Batch module reviews for cursor-server — rotate routes, services, jobs, config with optional auto merge between modules.
---

# Multi-module review — cursor-server

Parent orchestrator for sequential [domain-review](../domain-review/SKILL.md) runs across module slugs: `routes`, `services`, `jobs`, `config`.

## Parse

```
/multi-domain-review [auto] [dry-run]
```

| Flag | Effect |
|------|--------|
| `auto` | Each module: review → fix C/W → PR → merge → next |
| `dry-run` | Simulate git/gh; no writes |

## Queue

1. Slugs from domain-review catalog (table in SKILL.md).
2. Per slug: last review date in [REPORT.md](../domain-review/REPORT.md). Missing = never reviewed.
3. Order: `routes` → `services` → `jobs` → `config`, then by oldest review date.

## Parent rules

- **One module child at a time** — no parallel module reviews.
- **Base branch = `main`** (`origin/HEAD`; fallback `master`).
- After child reports `activeThreads == 0` (and not dry-run):

```
activeThreads == 0 → approve+merge PR → checkout main → pull → next module branch
```

1. Merge PR (approve + merge into `main`)
2. Sync local: `git checkout main && git pull origin main`
3. New branch for next slug from updated `main`
4. Last module — stay on `main` when done

## STOP conditions

- Parallel auto runs
- Skip merge between modules when `auto` and queue remains
- Spawn next module while previous PR still open

## References

- [domain-review/SKILL.md](../domain-review/SKILL.md)
- [code-review/SKILL.md](../code-review/SKILL.md)
- [stack.md](../../us-workflow/stack.md)
