```markdown
# cursor-server Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns used in the `cursor-server` TypeScript codebase. You'll learn about file naming, import/export styles, commit conventions, and how to write and run tests. The repository uses conventional commits, camelCase file naming, and relative imports, with an emphasis on clear, maintainable TypeScript code.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `cursorManager.ts`, `userSession.test.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { getUserSession } from './userSession';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // userSession.ts
    export function getUserSession(id: string) { ... }
    ```

### Commit Messages
- Follow **conventional commit** format.
- Common prefixes: `docs`, `feat`
  - Example: `feat: add user session management`

## Workflows

### Commit Code
**Trigger:** When making any code or documentation change  
**Command:** `/commit`

1. Stage your changes: `git add .`
2. Write a commit message using the conventional format:
   - Example: `feat: implement cursor broadcasting`
3. Commit your changes: `git commit -m "feat: implement cursor broadcasting"`
4. Push to your branch: `git push`

### Add a New Feature
**Trigger:** When implementing a new feature  
**Command:** `/add-feature`

1. Create a new file using camelCase naming.
2. Write your feature using TypeScript.
3. Use relative imports for any dependencies.
4. Export your functions or classes using named exports.
5. Add or update tests in a corresponding `.test.ts` file.
6. Commit your changes with a `feat:` prefix.

### Write and Run Tests
**Trigger:** When adding or updating tests  
**Command:** `/test`

1. Create or update a test file matching `*.test.ts`.
2. Write your tests using the project's testing framework (framework not detected; check project docs or package.json).
3. Run the test suite (typically `npm test` or `yarn test`).

## Testing Patterns

- Test files use the pattern: `*.test.ts`
  - Example: `cursorManager.test.ts`
- Place tests alongside the code they test or in a dedicated test directory.
- Follow the same import/export conventions as production code.

## Commands

| Command      | Purpose                                   |
|--------------|-------------------------------------------|
| /commit      | Commit code using conventional commits    |
| /add-feature | Scaffold and commit a new feature         |
| /test        | Write and run tests                       |
```
