---
name: config-or-env-change-with-documentation
description: Workflow command scaffold for config-or-env-change-with-documentation in cursor-server.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /config-or-env-change-with-documentation

Use this workflow when working on **config-or-env-change-with-documentation** in `cursor-server`.

## Goal

Updates configuration or environment schema and documents the change in README and example env files.

## Common Files

- `src/config.ts`
- `.env.example`
- `README.md`
- `AGENTS.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit src/config.ts to add or change config/env logic
- Update .env.example to reflect new/changed variables
- Update README.md and/or AGENTS.md to document the change

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.