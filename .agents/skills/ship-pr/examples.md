# ship-pr — examples (cursor-server)

## 1. Standard delivery

```
/ship-pr feat(tasks): add async job status endpoint
```

1. On feature branch; `detect-base-branch.sh` → `main`
2. Code-review auto-fix until **No feedback** (≤3 rounds)
3. `./.agents/skills/ship-pr/scripts/verify.sh` → green
4. Commit → `git push origin HEAD`
5. `gh pr create --base main`
6. Sleep 5m → `/goal-fix-pr <N> max 10`
7. `gh pr merge <N> --merge` when checks pass

**PR:** `gh pr view <N> --json url -q .url`

## 2. Dry-run

```
/ship-pr fix(config): validate PORT dry-run
```

Prints base branch, review plan, verify scope, PR body — no writes.

## 3. No merge

```
/ship-pr chore: deps bump no-merge
```

Stops after goal-fix-pr or when threads clear — does not merge.
