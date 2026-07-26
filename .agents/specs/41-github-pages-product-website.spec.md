---
id: null
slug: 41-github-pages-product-website
title: "GitHub Pages product website"
source: local
specDate: 2026-07-26
status: planned
version: 0.1.0
---

# Specification — GitHub Pages product website

## Description

Create a GitHub Pages website that presents cursor-server as a product. A repository deployment script must rebuild and publish the site automatically for every GitHub release created from `main`.

## Acceptance Criteria

- AC1: A static product website is published through GitHub Pages.
- AC2: The repository contains a documented script that builds the site and deploys its generated output to GitHub Pages.
- AC3: A GitHub Actions workflow automatically invokes the deployment script for every published GitHub release created from `main`.
- AC4: The release workflow fails clearly when the site build or Pages deployment fails, rather than publishing a partial site.

## Notes

- Confirm current GitHub Pages deployment requirements and release-event branch validation during planning.
