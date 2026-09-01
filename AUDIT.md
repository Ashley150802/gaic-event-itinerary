# Surket application audit — 17 June 2026

Scope: frontend/backend wiring, deployment entries, package/dependency policy, SQLite runtime, and public API contract.

## Dependency policy

The npm registry was not reachable from this sandbox during the audit, so exact version resolution could not be performed here. To still satisfy the “latest dependencies” requirement without inventing stale version numbers, all workspace package manifests now use pnpm with `latest` specifiers for app/runtime dependencies. A fresh `pnpm install` resolves the current latest versions available from the registry on install day.

- Package manager: `pnpm@9.12.0` via the root `packageManager` field.
- Workspace: `pnpm-workspace.yaml` only (`web`, `server`).
- No `package-lock.json` or `yarn.lock`.
- No native SQLite package; storage uses Node’s built-in `node:sqlite`.

## Backend audit findings and fixes

### 1. Template route drift

**Finding:** The architecture docs described canonical plural routes:

- `POST /api/templates/events/:id`
- `POST /api/templates/surveys/:id`

…but the implemented API/client used singular routes:

- `POST /api/templates/event/:id`
- `POST /api/templates/survey/:id`

**Fix:** Backend now supports both. Plural routes are canonical; singular routes remain aliases for backwards compatibility. The frontend client now calls the plural routes.

### 2. Event slug route shadowing

**Finding:** `/api/events/:id` was registered before `/api/events/slug/:slug`, so a request to `/api/events/slug/foo` could be captured as `id = "slug"` before the slug handler.

**Fix:** `/api/events/slug/:slug` is now registered before `/api/events/:id`.

### 3. URL/query encoding

**Finding:** Frontend API methods interpolated ids, join codes, and query params directly into URLs.

**Fix:** The frontend API client now uses `encodeURIComponent` for path ids, join codes, template ids, survey ids, event ids, WebSocket query params, and query values.

### 4. Submit response type mismatch

**Finding:** The backend returns `{ response, results }`, while the frontend API typed `submitResponse` as returning only `{ results }`.

**Fix:** Added `SubmitResponseResult` in `web/src/api.ts` with the correct `{ response, results }` shape.

### 5. Node SQLite startup portability

**Finding:** The root verify script used `node .verify.mjs`, which can fail on Node 22.5–23.3 unless `node:sqlite` is enabled.

**Fix:** The verify script now runs `node --experimental-sqlite .verify.mjs`. Server `dev` and `start` already pass the flag. The flag is harmless on newer Node releases.

## Frontend audit findings and fixes

- Confirmed route table still matches implemented SPA pages: dashboard, templates, join, event workspace, survey builder, respondent flow, live present mode.
- Confirmed client API routes map to backend routes after template pluralization and encoding fixes.
- Confirmed live-tally hook still supports WebSocket + polling fallback and version-gated updates.
- Confirmed no native Windows build dependency remains.

## Verification gates run in sandbox

Because network access to npm was unavailable, install/typecheck against newly resolved `latest` packages could not be executed here. The following offline gates are used instead:

1. `node:sqlite` data harness (`scripts/verify.ts`) — schema, seeding, templates, tallying, NPS, sentiment/keywords, live hub, duplication.
2. SPA esbuild bundle of `web/src/main.tsx` using the sandbox-installed React packages.
3. Syntax transform checks for backend entries and API client files.
4. Static grep audits for native SQLite dependency removal and package-manager consistency.

## Deployment notes

- Local/Node uses `node:sqlite` and `ws` for WebSockets.
- Vercel serverless uses `node:sqlite` for previews/demos and polling fallback for live tally. Use D1/Turso/libSQL or another durable store for production persistence.
- Cloudflare uses D1 + Durable Object live fan-out.
