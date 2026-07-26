---
id: null
slug: 41-github-pages-product-website
title: "GitHub Pages product website"
source: local
specDate: 2026-07-26
status: completed
version: 0.1.0
---

# Specification — GitHub Pages product website

## Description

Create a GitHub Pages website that presents cursor-server as a product. A repository deployment script must rebuild and publish the site automatically for every GitHub release created from `master`.

## Acceptance Criteria

- AC1: A static product website is published through GitHub Pages.
- AC2: The repository contains a documented script that builds the site and deploys its generated output to GitHub Pages.
- AC3: A GitHub Actions workflow automatically invokes the deployment script for every published GitHub release created from `master`.
- AC4: The release workflow fails clearly when the site build or Pages deployment fails, rather than publishing a partial site.

## Notes

- Static source lives in `website/`; `npm run deploy:pages` rebuilds generated output in `dist/pages/`.
- GitHub Actions uploads and deploys that output with GitHub's supported Pages actions. Browser-side JavaScript must not deploy Pages.
- The workflow must use the `release.published` event and verify the release tag commit is reachable from `master`. `target_commitish` alone is not sufficient when the tag already exists.

### [2026-07-26] Revision: implemented static site, deploy:pages, release.published Pages workflow (Prompt: "/ws-spec-to-pr full auto 41")
