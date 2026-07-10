# Senior Developer — testing (cursor-server)

Opt-out only if the user says so in-thread.

| Change | Expectation |
|--------|-------------|
| **Feature** | Add tests when a test runner exists; until then, document manual smoke steps in code review proof |
| **Bug fix** | **Regression test** when feasible; always run `npm run typecheck` and `npm run build` this session |
| **Refactor** | Existing checks green |
| **API / SDK paths** | Manual or automated smoke against `/health` and affected endpoints |

## Verification commands (required today)

```bash
npm run typecheck
npm run build
```

For task endpoints after changes:

```bash
npm run dev
curl http://localhost:3000/health
# POST /tasks requires CURSOR_API_KEY and a clone under repos/
```

Process: state success criteria → add tests when framework is added → cite fresh command output in proof.

**Bug-fix exceptions (opt-out):** comment/typo/docs-only → manual check in code review proof.

**Do not:** ship behavior without verification; claim checks pass without running them; **delete tests** unless the related behavior is removed in the same change.
