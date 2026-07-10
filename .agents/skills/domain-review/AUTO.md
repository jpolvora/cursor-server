# Module review — `auto` pipeline (cursor-server)

Runs after the module report when invocation includes **`auto`**.

Load when `auto` is set. Parent: [SKILL.md](SKILL.md).

## Verify

```bash
npm run typecheck
npm run build
```

Port conflict on `PORT` (default 3000) → ask before stopping user's server.

## Branch, commit, push

Branch: `module-review/{slug}-YYYY-MM-DD`

Commit message: `review({slug}): module-review findings and fixes`

## Create PR

```bash
gh pr create --title "review({slug}): module-review fixes" --body "## Summary
- Module-review auto pass for \`{slug}\`.
- Applied Critical/Warning fix plan.

## Test plan
- [ ] npm run typecheck
- [ ] npm run build
"
```

## goal-fix-pr

Follow [goal-fix-pr](../09-goal-fix-pr/SKILL.md) with `max 10`, 5 minute waits between rounds.

Stamp review date in [REPORT.md](REPORT.md) for the module slug.
