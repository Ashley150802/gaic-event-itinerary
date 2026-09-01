# ADR-003: Live Tally Transport Strategy

**Status:** Accepted

## Context

The live tally feature requires streaming response updates from respondents to a presenter's big screen in near-real-time. The platform deploys to three hosts with very different WebSocket capabilities:

- **Node.js**: Long-lived processes, can hold WebSocket connections natively
- **Cloudflare Workers**: Supports Durable Objects with WebSocket endpoints
- **Vercel Serverless**: Functions are ephemeral (10-60s), cannot hold persistent connections

## Decision

Implement a **transport-agnostic live tally** with automatic fallback:

1. `GET /api/config` tells the client which transport to use (`"websocket"` or `"polling"`)
2. **Node**: In-process `LiveHub` (pub/sub in `live.ts`) — `submitResponse` publishes to subscribed WebSocket clients
3. **Cloudflare**: Per-survey `LiveTallyRoom` Durable Object — holds WebSocket connections and broadcasts
4. **Vercel / Fallback**: Client polls `GET /api/surveys/:id/results` every 3 seconds, re-rendering only when `version` increases

The `SurveyResults.version` field is the monotonic cursor that makes polling safe — the UI only updates when the version changes, preventing flicker and double-counting.

The React hook `useLiveTally.ts` encapsulates both transports behind a single API.

## Consequences

- **Positive**: Live tally works on every supported host — no host is second-class for the audience.
- **Positive**: WebSocket failure gracefully degrades to polling — no user-facing errors.
- **Positive**: Adding a new transport (e.g., Ably, Pusher) only requires implementing the fan-out and updating `/api/config`.
- **Negative**: Polling adds 3-second latency on Vercel. Not truly real-time, but acceptable for most events.
- **Negative**: The `version` field must be maintained atomically. On D1, this means reading the current count and incrementing in the same transaction.
