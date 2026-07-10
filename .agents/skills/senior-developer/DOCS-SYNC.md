# Docs sync — cursor-server

When implementation changes **observable behavior**, update docs in the same session.

| Change type | Update |
|-------------|--------|
| New/changed HTTP route | `README.md` § API |
| New/changed env var | `README.md` § Environment, `.env.example` if present |
| Architecture / conventions | `AGENTS.md` |
| Roadmap / vision shift | `README.md` § Roadmap + `AGENTS.md` § Roadmap |
| Harness / skills | `AGENTS.md` § Skills index only — do not duplicate skill bodies |

Proof line in senior-developer code review proof: `**Docs sync:** README.md, AGENTS.md` or `N/A — no user-facing change`.
