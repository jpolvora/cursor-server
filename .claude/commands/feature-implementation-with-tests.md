---
name: feature-implementation-with-tests
description: Workflow command scaffold for feature-implementation-with-tests in cursor-server.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-implementation-with-tests

Use this workflow when working on **feature-implementation-with-tests** in `cursor-server`.

## Goal

Implements new or updated service/job logic and immediately adds or updates corresponding unit tests.

## Common Files

- `src/jobs/review-jobs.ts`
- `src/jobs/review-jobs.test.ts`
- `src/jobs/scheduler.ts`
- `src/jobs/scheduler.test.ts`
- `src/services/repo-hygiene.ts`
- `src/services/scheduled-review-runner.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or create main logic file(s) in src/jobs/ or src/services/
- Edit or create corresponding test file(s) in src/jobs/ or src/services/ with .test.ts suffix

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.