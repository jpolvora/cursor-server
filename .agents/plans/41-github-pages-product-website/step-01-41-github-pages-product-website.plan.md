# Plan — GitHub Pages product website

## Qualified decisions

- Author static source in `website/`; `npm run deploy:pages` rebuilds `dist/pages/`.
- GitHub Actions, not browser-side JavaScript, uploads and deploys the generated artifact using GitHub's supported Pages actions.
- Run only for `release.published`. Validate the release tag commit is reachable from `origin/main`; release `target_commitish` alone is not sufficient when a tag already exists.
- Keep release workflow independent of the repository's `develop` pull-request base.

## Steps

1. Add static product page and deterministic Node build script.
2. Add release workflow with tag ancestry validation, artifact upload, and official Pages deployment action.
3. Document local build and the required GitHub Pages publishing-source setting.
4. Verify generated output, workflow structure, TypeScript build, and secret scan.
