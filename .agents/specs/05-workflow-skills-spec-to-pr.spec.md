---
id: null
slug: 05-workflow-skills-spec-to-pr
title: "Workflow-Skills Spec-to-PR Runner Integration"
source: local
status: completed
---

# Spec: Workflow-Skills Spec-to-PR Runner Integration (`workflow-skills-spec-to-pr`)

## Context
`cursor-server` runs agent tasks against local checkouts under `REPOS_ROOT`. Repositories often have `workflow-skills` installed under `.agents/skills/` (specifically `spec-to-pr` and `spec-to-pr-lite`). Callers should be able to invoke `agent: "spec-to-pr"` or `agent: "spec-to-pr-lite"` via `POST /tasks` or `POST /events` to execute end-to-end spec delivery workflows on the server.

## Objectives
1. Add `spec-to-pr` and `spec-to-pr-lite` to the allowed task agent roles in `src/agents.ts`.
2. Support role resolution and aliases (e.g. `spec_to_pr`, `spec-to-pr-lite`, `spec_to_pr_lite`).
3. Formulate system/user prompt guidance in `src/services/agent-runner.ts` that instructs the local Cursor SDK agent to read and follow `.agents/skills/ws-spec-to-pr/SKILL.md` or `.agents/skills/ws-spec-to-pr-lite/SKILL.md` in the target repository working tree.
4. Keep full backward compatibility with `default`, `planner`, `implementer`, and `plan+implementer`.

## Acceptance Criteria
- [x] `AGENTS` allowlist in `src/agents.ts` includes `"spec-to-pr"` and `"spec-to-pr-lite"`.
- [x] `resolveAgent()` correctly resolves string inputs like `"spec-to-pr"` and `"spec-to-pr-lite"` (plus aliases `"spec_to_pr"`, `"spec_to_pr_lite"`).
- [x] `GET /agents` lists `"spec-to-pr"` and `"spec-to-pr-lite"` in the available agent roles array.
- [x] `agent-runner.ts` constructs appropriate execution prompts when `agent` is set to `"spec-to-pr"` or `"spec-to-pr-lite"`.
- [x] Typecheck, build, and tests pass.
