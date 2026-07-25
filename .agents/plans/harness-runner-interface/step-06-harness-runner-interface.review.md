# Code Review Report — Pluggable Harness Runner Interface

## Review Summary

- **Architecture & Design**: Clean separation of interface (`HarnessRunner`), data contracts (`StageInput`/`StageOutput`), local SDK adapter (`LocalCursorRunner`), and central registry (`RunnerRegistry`).
- **Safety & Robustness**: Default runner `cursor-local` cannot be accidentally unregistered or overwritten without explicit registration. Unregistered requests fall back safely.
- **Type Safety**: Full TypeScript type coverage with Zod/Node standard compliance.
- **Code Quality**: No hardcoded secrets or absolute paths.
