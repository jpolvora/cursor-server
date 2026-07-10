# Changelog

Historical record of agent implementation work. Append-only — do not use for regression context (see `MEMORY.md`).

### [2026-07-10 00:15] Agent: Cursor
- **Prompt**: Update all `.agents/**` skills for cursor-server stack; remove private Matrix references; add progressive-disclosure skills index to AGENTS.md
- **Done**: Rewrote stack.md, senior-developer, code-review, workflow skills (01–11), check-harness; added typescript-security-review; repointed domain-review to src modules; updated AGENTS.md skills index + task router; removed solve-pr Matrix run artifacts; deprecated matrix-view-patterns, dotnet-security, 08-fix-pr Azure skill
- **Result**: Harness aligned to TypeScript/Hono/@cursor/sdk; AGENTS.md is the routing hub for all skills

### [2026-07-10 00:30] Agent: Cursor
- **Prompt**: Create pre-commit secrets skill with husky hook and scanner for hardcoded keys/passwords before public git commits
- **Done**: Added `pre-commit-secrets` skill, `scripts/scan-secrets.mjs`, husky `.husky/pre-commit`, `npm run scan-secrets`; registered in AGENTS.md Layer 1 + verification + task router
- **Result**: `npm run scan-secrets` passes on repo; husky blocks commits with detected secrets or `.env` files
