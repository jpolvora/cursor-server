---
id: null
slug: 03-client-auth
title: "Client Authentication"
source: local
status: completed
---

# Spec: Client Authentication (`client-auth`)

## Context
`cursor-server` exposes HTTP APIs over Tailscale or local networks. To prevent unauthorized callers from triggering resource-heavy agent operations, client authentication is required for mutating endpoints.

## Objectives
1. Add optional/configurable `SERVER_API_KEY` environment variable.
2. Implement Hono authentication middleware checking `X-API-Key` header or `Authorization: Bearer <key>`.
3. Require authentication on protected routes (such as `POST /tasks`).
4. Allow unauthenticated public access for operational monitoring (`GET /health`, `GET /agents`).
5. Support local development / zero-auth mode when `SERVER_API_KEY` is not set or empty.

## Acceptance Criteria
- [x] Environment validation in `src/config.ts` parses optional `SERVER_API_KEY` (string).
- [x] If `SERVER_API_KEY` is configured:
  - Requests missing valid API key receive `401 Unauthorized` with `{ "error": "Unauthorized" }`.
  - Requests with header `X-API-Key: <key>` or `Authorization: Bearer <key>` matching `SERVER_API_KEY` pass authentication.
- [x] If `SERVER_API_KEY` is empty/unset:
  - Server logs a warning on startup indicating authentication is disabled.
  - Requests pass through without 401 errors.
- [x] `GET /health` and `GET /agents` remain accessible without an API key regardless of `SERVER_API_KEY` config.
- [x] Typecheck, build, and tests pass.
