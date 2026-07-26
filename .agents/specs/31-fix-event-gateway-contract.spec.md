# Spec: Fix Event Gateway Contract (`31-fix-event-gateway-contract`)

## Context
Some external clients (Hermes, Umbrel webhooks) send `POST /events` payloads without an `event` field. The gateway currently rejects those requests, breaking backward-compatible ingestion.

## Objectives
1. Make `event` optional on `POST /events` with a sensible default for generic task ingestion.
2. Preserve webhook callback delivery when `webhookUrl` is provided.
3. Add route-level tests covering defaulting and webhook passthrough.

## Acceptance Criteria
- [ ] `POST /events` accepts payloads without `event` and responds with `event: "task"` (default generic task).
- [ ] Explicit `event` values are echoed in the `202` response.
- [ ] `webhookUrl` is stored on the queued task for completion callbacks.
- [ ] `npm run typecheck`, `npm run build`, and `npm test` pass.
