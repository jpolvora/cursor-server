---
name: verify-plan
description: Verify and grade the execution of the latest implementation plan. Use when evaluating a completed plan, grading implementation quality, or deciding whether to code-review and commit changes.
---

# Verify Plan

Evaluate plan implementation, assign a quality score, and recommend next actions.

## Quick start

Analyze target plan file (e.g., `implementation_plan.md` or `.cursor/plans/*.md`) and git diff/status. Generate report using [TEMPLATE.md](TEMPLATE.md).

## Workflows

1. **Locate Plan & Changes**
   - Find the implementation plan that was just executed.
   - Run `git status` and `git diff` to see all changed files.

2. **Evaluate Core Criteria**
   - **Completeness**: Are all planned files/changes implemented?
   - **Correctness**: Do changes match cursor-server patterns (thin routes, SDK disposal, REPOS_ROOT)?
   - **Tests**: Run `npm run typecheck` and `npm run build`. Document manual smoke when routes change.

3. **Grade and Recommend**
   - Grade implementation from 0 to 10.
   - **Score < 7**: Recommend Reimplement. Identify missing or incorrect areas, suggest redesigning plan or switching models.
   - **Score >= 7**: Recommend Approve. Run `code-review` skill and propose a commit command.

4. **Write Report**
   - Fill out [TEMPLATE.md](TEMPLATE.md). Output to chat.
