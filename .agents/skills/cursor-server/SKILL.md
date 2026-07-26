---
name: cursor-server
description: >
  Local cursor-server coding conventions and workflows (camelCase files, relative
  imports, named exports, conventional commits, feature+tests, config/docs sync).
  Use when implementing or refactoring in this TypeScript Hono codebase, or when
  asked for project patterns / /implement-feature-with-tests / /update-config-docs.
disable-model-invocation: true
---

# cursor-server Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and workflows used in the `cursor-server` TypeScript codebase. You'll learn the project's coding conventions, how to implement features with tests, update configuration with proper documentation, and follow best practices for maintainability and clarity.

## Coding Conventions

- **File Naming:**  
  Use `camelCase` for file names.  
  _Example:_  
  ```
  src/jobs/reviewJobs.ts
  src/services/scheduledReviewRunner.ts
  ```

- **Import Style:**  
  Use **relative imports** within the codebase.  
  _Example:_  
  ```typescript
  import { runReviewJobs } from './reviewJobs';
  ```

- **Export Style:**  
  Use **named exports** rather than default exports.  
  _Example:_  
  ```typescript
  // In src/services/repoHygiene.ts
  export function checkRepoHygiene() { ... }
  ```

- **Commit Messages:**  
  Follow **conventional commit** style, using prefixes like `fix` and `docs`.  
  _Example:_  
  ```
  fix: handle empty job queue gracefully
  docs: update README with new config variable
  ```

## Workflows

### Feature Implementation with Tests
**Trigger:** When adding or updating service/job logic and ensuring it is covered by tests  
**Command:** `/implement-feature-with-tests`

1. Edit or create the main logic file(s) in `src/jobs/` or `src/services/`.
2. Edit or create the corresponding test file(s) in the same directory, using the `.test.ts` suffix.
3. Ensure all new or changed logic is covered by unit tests.
4. Example:
   ```typescript
   // src/jobs/scheduler.ts
   export function scheduleJobs() { ... }

   // src/jobs/scheduler.test.ts
   import { scheduleJobs } from './scheduler';
   test('schedules jobs correctly', () => { ... });
   ```
5. Commit changes with a conventional commit message.

### Config or Env Change with Documentation
**Trigger:** When adding or changing a config/env variable and keeping docs/examples in sync  
**Command:** `/update-config-docs`

1. Edit `src/config.ts` to add or change config/env logic.
2. Update `.env.example` to reflect new or changed variables.
3. Update `README.md` and/or `AGENTS.md` to document the change.
4. Example:
   ```typescript
   // src/config.ts
   export const NEW_FEATURE_FLAG = process.env.NEW_FEATURE_FLAG === 'true';

   // .env.example
   NEW_FEATURE_FLAG=false

   // README.md
   ## Environment Variables
   - `NEW_FEATURE_FLAG`: Enable or disable the new feature (default: false)
   ```
5. Commit all related changes with a `docs:` or `fix:` prefix as appropriate.

## Testing Patterns

- **Test File Naming:**  
  Test files use the `.test.ts` suffix and are placed alongside the files they test.
  _Example:_  
  ```
  src/jobs/reviewJobs.ts
  src/jobs/reviewJobs.test.ts
  ```

- **Testing Framework:**  
  The specific framework is not detected, but tests follow standard TypeScript patterns.

- **Test Example:**
  ```typescript
  import { reviewJobs } from './reviewJobs';

  test('reviews jobs as expected', () => {
    // Arrange
    // Act
    // Assert
  });
  ```

## Commands

| Command                      | Purpose                                                        |
|------------------------------|----------------------------------------------------------------|
| /implement-feature-with-tests | Implement new/updated logic with corresponding unit tests       |
| /update-config-docs          | Update config/env logic and synchronize documentation/examples  |
