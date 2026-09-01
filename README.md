# Surket

**All-in-one event itinerary + live survey platform.**
_Powered by Lehro Solutions._

Surket lets organizers run an event end to end: publish a day's **itinerary**, attach **surveys** to it, collect answers **on demand** from attendees' phones, and **tally results live** on a big screen in front of the audience. It ships with multiple ready-to-use **templates**, a professional dashboard UI, and a backend that runs on plain SQLite today and scales to Cloudflare D1 / Vercel tomorrow.

---

## Why Surket

- **Itinerary + surveys, merged.** An event has a timeline of segments (keynote, session, workshop, panel, break, networking, survey). Any segment can link to a survey, so "now answer this" is one tap away.
- **Live tally.** Responses stream to a presenter view via WebSockets, with an automatic polling fallback so it works on any host.
- **Template-friendly.** One-click event blueprints (AI meetup, conference, workshop) and survey templates (live pulse, NPS, event feedback, product concept, workshop feedback).
- **8 question types.** `single`, `multi`, `rating`, `nps`, `scale`, `number`, `date`, `text` — with built-in analytics (averages, NPS score, sentiment, keywords, response timeline).
- **Build on top.** A stable, documented HTTP contract and a runtime-agnostic `Store` interface. See [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Deploy anywhere.** Vercel (Node + serverless) or Cloudflare (Workers + D1 + Durable Objects). See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Monorepo layout

```
surket/
  web/                 React + Vite SPA (dashboard, builder, present, respond)
  server/              Hono API + SQLite/D1 store + live tally engine
    src/
      types.ts         Domain types + the Store contract
      schema.ts        SQL schema (shared by every driver)
      util.ts          ids, slugs, join codes, coercion helpers
      sqliteStore.ts   Store impl over a tiny SqliteDriver (Node + node:sqlite)
      d1Store.ts       Store impl over Cloudflare D1
      aggregate.ts     Pure analytics engine (tally, NPS, sentiment, keywords)
      templates.ts     Event + survey blueprints
      seed.ts          Demo data
      live.ts          In-memory LiveHub (pub/sub) + topic helpers
      service.ts       Composition layer used by BOTH runtimes
      app.ts           Hono app (routes)
      index.ts         Node entry (node:sqlite + ws)
      worker.ts        Cloudflare entry (D1 + Durable Object)
    migrations/        D1 migration SQL
  api/                 Vercel serverless entry that mounts the Hono app
  scripts/             verify.ts — DB-logic verification harness
  vercel.json          Vercel build + routing
  wrangler.toml        (server/) Cloudflare config
```

---

## Quick start (local, SQLite)

Requirements: **Node 22.5+** (Node 24+ recommended) and [pnpm](https://pnpm.io) 9+ (this is a pnpm workspace — use pnpm). Dependency ranges intentionally use `latest` so a fresh `pnpm install` resolves the current latest compatible package versions on install day.

> Storage uses Node's **built-in `node:sqlite`** — there is **no native module** to compile, so you do **not** need Visual Studio / Windows Build Tools, Python, or any C/C++ toolchain. `pnpm install` never builds binaries.
>
> `node:sqlite` is built into Node and is unflagged from Node 23.4+. The `dev`/`start` scripts pass `--experimental-sqlite` so Node 22.5–23.3 also work out of the box.

```bash
corepack enable
pnpm install

# Terminal 1 — API on http://localhost:8787 (node:sqlite + WebSockets)
pnpm --filter @surket/server dev

# Terminal 2 — SPA on http://localhost:5173 (proxies /api to the server)
pnpm --filter @surket/web dev
```

Open http://localhost:5173. The server seeds a demo event + surveys on first run (set `SURKET_SEED=0` to skip).

### Environment variables

| Variable          | Where    | Default                 | Purpose                                   |
| ----------------- | -------- | ----------------------- | ----------------------------------------- |
| `PORT`            | server   | `8787`                  | Node HTTP port                            |
| `SURKET_DB`       | server   | `./surket.db`           | SQLite file path                          |
| `SURKET_SEED`     | server   | `1`                     | `0` disables demo seeding                 |
| `ADMIN_TOKEN`     | server   | _(unset = open)_        | If set, write routes require the token    |
| `VITE_API_BASE`   | web      | `""` (same origin)      | Absolute API base for the SPA             |
| `VITE_API_TARGET` | web dev  | `http://localhost:8787` | Dev proxy target                          |

---

## Admin token

Write operations (create/update/delete events, surveys, questions, segments) are gated by `ADMIN_TOKEN` when it is set. The SPA stores a token in `localStorage` (`surket.adminToken`) and sends it as the `x-admin-token` header — set it from the topbar **Operator** control. Submitting survey responses and reading public results never require the token, so attendees just scan and answer.

---

## Verifying the data layer

The analytics + storage logic is covered by a harness that runs the real code against Node's built-in `node:sqlite`:

```bash
pnpm verify
# bundles scripts/verify.ts and runs 36 assertions: schema, seed idempotency,
# templates, tally correctness, NPS, sentiment/keywords, live broadcast, duplicate.
```

---

## Where to go next

- **Extend the product** (new question type, new template, new route): [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Ship it** (Vercel or Cloudflare, durable storage): [`DEPLOYMENT.md`](./DEPLOYMENT.md)
