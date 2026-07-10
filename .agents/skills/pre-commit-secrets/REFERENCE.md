# Pre-commit secrets — reference

Scanner: [`scripts/scan-secrets.mjs`](../../../scripts/scan-secrets.mjs)

## Modes

| Flag | Scope |
|------|--------|
| (default) | `git diff --cached` — staged adds/modifies/copies |
| `--all` | `git ls-files` — full tracked tree audit |

## Always blocked (whole file)

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `.env.test`

`.env.example` is allowed **only** with placeholder values.

## Skipped paths

Directories: `node_modules/`, `dist/`, `.git/`, `coverage/`

Path prefixes (intentional security examples): `.agents/skills/security-review/`

Extensions: images, fonts, archives, lockfiles (binary/low-signal)

## Placeholder allowlist (line-level)

A matched line is ignored when it contains:

- `...`, `xxx`, `placeholder`, `changeme`, `your-`, `example`
- `<PLACEHOLDER>`, `REDACTED`, `fake`, `dummy`, `sample`, `insert-here`, `replace-me`, `todo`
- `process.env.` or `import.meta.env.` (env indirection)
- `.env.example` lines like `KEY=cursor_...`

## Detector rules

| Rule | Pattern intent |
|------|----------------|
| Private key block | PEM `BEGIN … PRIVATE KEY` |
| AWS access key | `AKIA` + 16 chars |
| GitHub PAT | `ghp_`, `github_pat_` |
| Cursor API key | `cursor_` + 20+ chars (not `cursor_...`) |
| Slack token | `xoxb-`, `xoxp-`, etc. |
| Stripe key | `sk_live_`, `sk_test_`, `rk_live_` |
| Google API key | `AIza…` |
| Anthropic key | `sk-ant-api…` |
| OpenAI key | `sk-proj-…`, classic `sk-…T3BlbkFJ…` |
| Tailscale key | `tskey-auth-…` |
| Assignment | `api_key` / `secret` / `password` / `token` = quoted string ≥12 chars |
| Bearer literal | `Bearer <token>` in source |

## Adding a rule

Edit `RULES` in `scripts/scan-secrets.mjs`. Prefer high-signal patterns; add placeholder exceptions to `PLACEHOLDER_RE` or `isAllowedLine()` to limit false positives.

## False positives

If a test fixture or docs need a matching string, use an obvious placeholder substring (`example`, `fake`, `xxx`) or keep the file out of git.

## Related project rules

- [AGENTS.md](../../../AGENTS.md) — do not commit `.env` or API keys
- [typescript-security-review](../typescript-security-review/SKILL.md) — runtime secret handling in `src/`
