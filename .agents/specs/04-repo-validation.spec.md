---
id: null
slug: 04-repo-validation
title: "Repository Registration and Validation"
source: local
status: completed
---

# Spec: Repository Registration and Validation (`repo-validation`)

## Context
`POST /tasks` receives a target `repo` parameter resolved relative to `REPOS_ROOT`. Before running agent execution, `cursor-server` must ensure the path exists, is inside `REPOS_ROOT`, and is a valid git working tree to prevent security risks (path traversal) and unhelpful runtime failures.

## Objectives
1. Resolve `{REPOS_ROOT}/{repo}` into a canonical absolute path and verify it stays strictly inside `REPOS_ROOT`.
2. Check that the target directory exists on disk.
3. Validate that the directory is a git repository (contains `.git` folder or passes git root validation).
4. Return clean 4xx HTTP responses (`400 Bad Request` / `404 Not Found`) before starting the local Cursor SDK agent.

## Acceptance Criteria
- [x] Safe path resolution prevents directory traversal (e.g., `repo: "../../etc"` returns `400 Bad Request`).
- [x] Non-existent repository folder returns `404 Not Found` with `{ "error": "Repository not found" }`.
- [x] Non-git repository folder returns `400 Bad Request` with `{ "error": "Repository path is not a valid git working tree" }`.
- [x] Valid git repositories pass validation and allow task execution to proceed.
- [x] Typecheck, build, and tests pass.
