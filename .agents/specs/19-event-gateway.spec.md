# Spec: Event Gateway (`event-gateway`)

## Context
External clients (Hermes Agent, Umbrel UI, webhooks) need a standardized event ingestion API (`POST /events`) to trigger remote agent operations based on external events.

## Objectives
1. Expose `POST /events` endpoint.
2. Accept event payloads with `source` (`"hermes" | "umbrel" | "ide" | "api"`), `repo`, `prompt`, and optional `agent`, `model`, `webhookUrl`.
3. Validate client authentication and target git repository.
4. Enqueue background agent task and return `202 Accepted` + `taskId`.

## Acceptance Criteria
- [x] `POST /events` requires valid API key when `SERVER_API_KEY` is configured.
- [x] Validates repository existence and git tree status using `repo-validator`.
- [x] Enqueues task and returns `202 Accepted` with `{ taskId, status: "queued", source, repo }`.
- [x] Dispatches optional webhook callback on task completion when `webhookUrl` is provided.
- [x] Typecheck, build, and tests pass.
