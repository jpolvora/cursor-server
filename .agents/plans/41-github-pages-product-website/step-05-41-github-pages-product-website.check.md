# Check-implementation — 41-github-pages-product-website

## AC map

| AC | Evidence | Status |
|----|----------|--------|
| AC1 Static product website via GitHub Pages | `website/index.html`, `website/styles.css`; workflow uploads `dist/pages` via official Pages actions | Pass |
| AC2 Documented script builds + deploys generated output | `npm run deploy:pages` → `scripts/build-pages-site.mjs`; README Product website + Scripts table | Pass |
| AC3 `release.published` + tag reachable from `main` | `.github/workflows/deploy-pages.yml` `on.release.types: [published]`; `git merge-base --is-ancestor` vs `origin/main` | Pass |
| AC4 Fail clearly; no partial publish | Build fails before upload; `deploy` `needs: build`; `cancel-in-progress: false`; deploy-pages only after artifact | Pass |

## Commands

- `npm run test:pages` — pass
- `npm run typecheck` — pass
- `npm run build` — pass
- `npm run scan-secrets` (staged) — pass

## Verdict

Implemented. Ready for review/ship.
