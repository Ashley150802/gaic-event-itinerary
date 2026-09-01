# Deployment

Surket targets two hosts out of the box: **Vercel** and **Cloudflare**. The same
application code runs on both because every runtime constructs a `Store` + a
live hub and hands them to the shared Hono app.

> **No native build tools.** The Node/Vercel runtimes use Node's built-in
> `node:sqlite`, not `better-sqlite3`, so installing and deploying requires no
> C/C++ compiler, Python, or Visual Studio Build Tools. This needs Node 22.5+
> (unflagged from 23.4; on Vercel set `NODE_OPTIONS=--experimental-sqlite` if the
> function runs an older 22.x).
>
> **Storage durability note.** Local/Node uses a SQLite file, which is perfect
> for development and single-instance hosts. **Serverless filesystems are
> ephemeral** — on Vercel/Cloudflare a file-based SQLite DB will not persist or
> share across invocations. For production, use **Cloudflare D1** (built in) or a
> hosted libSQL/Turso endpoint. The `Store` contract makes this a config
> change, not a rewrite.

---

## Option 1 — Vercel (SPA + serverless API)

The SPA is built as static assets; the API runs as a serverless function
(`api/index.ts` mounts the shared Hono app). Configuration lives in
`vercel.json`.

1. Push the repo to GitHub and import it in Vercel.
2. Build settings (already encoded in `vercel.json`):
   - Build: `pnpm install && pnpm --filter @surket/web build`
   - Output: `web/dist`
   - `/api/*` is routed to the serverless function.
3. Set environment variables in the Vercel dashboard:
   - `ADMIN_TOKEN` — protect write routes.
   - `SURKET_DB` — a **durable** SQLite/libSQL URL (e.g. Turso). Do **not** rely
     on a local file in production.
   - `VITE_API_BASE` — usually empty (same origin).
4. Deploy.

**Live tally on Vercel:** serverless functions are short-lived and don't hold
WebSocket connections, so `/api/config` reports `polling`. The SPA polls
`/results` and advances on `version` changes. For push-based updates on Vercel,
put the live hub on a durable transport (e.g. a Cloudflare Durable Object,
Upstash, or Ably) — the `LiveHub` boundary in `service.ts` is the seam.

---

## Option 2 — Cloudflare (Workers + D1 + Durable Objects)

This is the recommended production setup: durable storage **and** true push live
tally.

1. Install deps, then authenticate Wrangler (it ships as a dev dependency — no global install needed): `pnpm install` then `cd server && pnpm exec wrangler login`.
2. Create a D1 database and copy its id (run from `server/`):
   ```bash
   pnpm exec wrangler d1 create surket
   ```
   Put the id into `server/wrangler.toml` (`database_id`).
3. Apply the migration:
   ```bash
   pnpm exec wrangler d1 migrations apply surket --remote
   ```
   (omit `--remote` for the local dev DB)
4. Build the SPA so the Worker can serve it as static assets:
   ```bash
   pnpm --filter @surket/web build
   ```
5. Set the admin token as a secret (from `server/`):
   ```bash
   pnpm exec wrangler secret put ADMIN_TOKEN
   ```
6. Deploy (from the repo root):
   ```bash
   pnpm run deploy:cf
   ```

### Cloudflare bindings (`server/wrangler.toml`)

| Binding      | Type            | Purpose                                   |
| ------------ | --------------- | ----------------------------------------- |
| `DB`         | D1 database     | Durable storage (via `d1Store.ts`).       |
| `LIVE_TALLY` | Durable Object  | Per-survey live fan-out (`LiveTallyRoom`). |
| `ASSETS`     | Static assets   | Serves the built SPA.                     |
| `ADMIN_TOKEN`| Secret          | Gates write routes.                       |

`compatibility_flags = ["nodejs_compat"]` is set so the shared code runs
unchanged.

---

## Backend choice summary

| Host       | Storage driver        | Live transport         | Best for                         |
| ---------- | --------------------- | ---------------------- | -------------------------------- |
| Local/Node | `node:sqlite` file    | WebSocket (`ws`)       | Development, single-box hosting  |
| Vercel     | libSQL/Turso (D1-API) | Polling (or external)  | Static SPA + serverless API      |
| Cloudflare | D1                    | Durable Object (push)  | Production, live audience tally  |

The data logic is identical in every column — only the entry point and the
injected `Store` differ.
