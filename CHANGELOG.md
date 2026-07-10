# Changelog

Historical record of agent implementation work. Append-only — do not use for regression context (see `MEMORY.md`).

### [2026-07-10 00:15] Agent: Cursor
- **Prompt**: Update all `.agents/**` skills for cursor-server stack; remove private Matrix references; add progressive-disclosure skills index to AGENTS.md
- **Done**: Rewrote stack.md, senior-developer, code-review, workflow skills (01–11), check-harness; added typescript-security-review; repointed domain-review to src modules; updated AGENTS.md skills index + task router; removed solve-pr Matrix run artifacts; deprecated matrix-view-patterns, dotnet-security, 08-fix-pr Azure skill
- **Result**: Harness aligned to TypeScript/Hono/@cursor/sdk; AGENTS.md is the routing hub for all skills
