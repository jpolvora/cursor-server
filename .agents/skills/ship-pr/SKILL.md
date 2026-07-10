---
name: ship-pr
description: End-to-end delivery — code-review auto-fix, verify, commit on develop, push, PR develop→master/main (auto-detect), goal-fix-pr (5m waits, max 10), merge commit. Use when user asks to ship, deliver, commit-and-PR, push-and-merge, or `/ship-pr`.
disable-model-invocation: true
---

# ship-pr

Preflight → [code-review](../code-review/SKILL.md) auto-fix → verify → commit → push `develop` → PR → [goal-fix-pr](../09-goal-fix-pr/SKILL.md) → merge.

**Invocation authorizes** commit, push, PR, thread resolution, merge (unless `dry-run` / `no-merge`).

## Parse

`/ship-pr [commit-title] [base=<branch>] [dry-run] [no-merge] [max <n>]`

| Token | Default |
|-------|---------|
| `base` | auto → `master`/`main` via [detect-base-branch.sh](scripts/detect-base-branch.sh) |
| `max` | `10` goal-fix-pr iterations |
| PR | **`develop` → base** |

Restate title, base, head=`develop`, mode, max, merge.

## Preconditions

`gh` auth; feature branch up to date with remote. Dirty unrelated files → stop. Port 3000 conflict → ask before stopping dev server. [senior-developer](../senior-developer/SKILL.md) + Learning + Changelog at end.

## Pipeline

`preflight → code-review loop → verify.sh → commit → push → PR → sleep 5m → goal-fix-pr → merge`

### 0. Preflight

```bash
git branch --show-current   # develop
git fetch origin && git pull origin develop
export SHIP_PR_BASE="$(./.agents/skills/ship-pr/scripts/detect-base-branch.sh)"
```

### 1. Code-review loop (auto-fix)

Load [code-review](../code-review/SKILL.md); diff vs `$SHIP_PR_BASE` + uncommitted.

- **Sem feedback** → step 2
- Else auto-fix **Critical** + **Project patterns** (surgical); re-review
- Max **3** rounds → stop if still blocked

### 2. Verify

```bash
./.agents/skills/ship-pr/scripts/verify.sh
```

Fail → fix, restart from step 1. Same failure **3×** → stop.

### 3–4. Commit + push

HEREDOC commit (no secrets/`bin`/`obj`). `git push -u origin develop`. `dry-run` → skip writes.

### 5. PR

`gh pr create --head develop --base "$SHIP_PR_BASE"`. Reuse existing PR if open. Capture **number** and **url**:

```bash
gh pr view <N> --json number,url,state -q '{number: .number, url: .url}'
```

### 6. goal-fix-pr

**300s** before first collect + every heartbeat; `AGENT_SHIP_PR_WAKE_<PR>`; `/goal-fix-pr <PR> max <n>`. [GOAL-OVERRIDES.md](GOAL-OVERRIDES.md) · [examples.md](examples.md).

### 7. Merge

`activeThreads == 0` → `gh pr checks --watch` → `gh pr merge --merge --delete-branch`. Skip if `no-merge`/`dry-run`. Do **not** `--delete-branch` when head is `develop`.

## Final reply (mandatory)

End **every** ship-pr session with the PR link on its **own line**:

```markdown
**PR:** https://github.com/<owner>/<repo>/pull/<N>
```

`gh pr view <N> --json url,state -q '"\(.url) (\(.state))"'` after create/reuse. Never omit URL when a PR exists. `dry-run` / stopped early → `PR not created` + reason (no fake link).

## Scripts

| Script | Role |
|--------|------|
| [detect-base-branch.sh](scripts/detect-base-branch.sh) | `master` or `main` |
| [verify.sh](scripts/verify.sh) | `npm run typecheck` + `npm run build` |

## Stop

Verify 3× · code-review 3× blocked · Escalar · `max` exhausted · merge blocked.

## Dependencies

[code-review](../code-review/SKILL.md) · [goal-fix-pr](../09-goal-fix-pr/SKILL.md) · [solve-pr](../solve-pr/SKILL.md)
