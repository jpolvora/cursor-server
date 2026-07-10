---
name: pre-commit-secrets
description: Scans staged files for hardcoded secrets, API keys, passwords, and blocked env files before git commit. Use after implementation and before commit, or when user mentions secret leak prevention, husky, or pre-commit hooks.
---

# Pre-commit secrets scan

**Gate:** run after code changes, **before** `git commit` (or when user asks to commit).

Husky runs the same check automatically on commit. Agents must run it manually when verifying work pre-commit.

## Quick start

```bash
npm run scan-secrets          # staged files (same as pre-commit hook)
npm run scan-secrets -- --all # all tracked files (audit)
```

Exit `0` = safe to commit. Exit `1` = fix findings first.

## Agent workflow

1. Finish implementation + `npm run typecheck` / `npm run build`.
2. Run `npm run scan-secrets` on **staged** files (stage first if needed).
3. On failure:
   - Remove hardcoded secrets; use `process.env` / `.env` (gitignored).
   - Keep placeholders only in `.env.example` (`cursor_...`, `changeme`, etc.).
   - Never stage `.env`, `.env.local`, or credential files.
4. Re-run until clean, then commit.

## What it blocks

| Category | Examples |
|----------|----------|
| Env files | `.env`, `.env.local`, `.env.production` |
| API keys | `cursor_*`, `ghp_*`, `sk-*`, `AIza*`, `sk-ant-*` |
| Cloud keys | `AKIA*`, Stripe `sk_live_*`, Slack `xox*` |
| Crypto material | PEM private key blocks |
| Literals | `password = "..."`, `api_key: "..."` with real values |

Placeholders (`...`, `xxx`, `placeholder`, `changeme`, `your-*`) and `process.env.*` references are allowed.

## Husky setup (repo)

Already wired when this skill is installed:

- `package.json` → `"prepare": "husky"`, `"scan-secrets": "node scripts/scan-secrets.mjs"`
- `.husky/pre-commit` → `npm run scan-secrets`

After clone: `npm install` (runs `husky` via `prepare`).

## Advanced

Pattern catalog, allowlist rules, adding detectors: [REFERENCE.md](REFERENCE.md).
