# Deployment Guide

Surket targets three deployment environments out of the box. The same application code runs on all three because every runtime constructs a `Store` + a live hub and hands them to the shared Hono app.

---

## Prerequisites

- **Node.js ≥ 22.5.0** (24+ recommended)
- **pnpm 9+** (this is a pnpm workspace)
- No C/C++ toolchain, Python, or Visual Studio Build Tools needed

---

## Option 1 — Local / Self-Hosted (Node.js + SQLite)

Perfect for development, testing, and single-box hosting.

### Setup

```bash
git clone https://github.com/LehroSolutions/surket.git
cd surket
corepack enable
pnpm install
```

### Run

```bash
# Terminal 1 — API server (SQLite + WebSocket live tally)
pnpm --filter @surket/server dev

# Terminal 2 — SPA (proxies /api to the server)
pnpm --filter @surket/web dev
```

### Production Mode

```bash
pnpm build
ADMIN_TOKEN=your-secret pnpm start
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | HTTP port |
| `SURKET_DB` | `./surket.db` | SQLite file path |
| `SURKET_SEED` | `1` | Set `0` to disable demo data seeding |
| `ADMIN_TOKEN` | _(unset)_ | Protects write routes when set |
| `VITE_API_BASE` | `""` | API base URL for the SPA |
| `VITE_API_TARGET` | `http://localhost:8787` | Dev proxy target |

---

## Option 2 — Cloudflare (Workers + D1 + Durable Objects)

**Recommended for production**: durable storage + true push-based live tally.

### Step 1: Authenticate Wrangler

```bash
cd server
pnpm exec wrangler login
```

### Step 2: Create D1 Database

```bash
pnpm exec wrangler d1 create surket
```

Copy the returned `database_id` into `server/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "surket"
database_id = "YOUR_D1_DATABASE_ID"
```

### Step 3: Apply Schema Migration

```bash
# Remote (production)
pnpm exec wrangler d1 migrations apply surket --remote

# Local dev DB (optional)
pnpm exec wrangler d1 migrations apply surket --local
```

### Step 4: Build the SPA

```bash
cd ..
pnpm --filter @surket/web build
```

### Step 5: Set Admin Token (Secret)

```bash
cd server
pnpm exec wrangler secret put ADMIN_TOKEN
```

### Step 6: Deploy

From the repo root:

```bash
pnpm run deploy:cf
```

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 database | Durable storage via `d1Store.ts` |
| `LIVE_TALLY` | Durable Object | Per-survey live WebSocket fan-out |
| `ASSETS` | Static assets | Serves the built SPA from `web/dist` |
| `ADMIN_TOKEN` | Secret | Gates write routes |

### wrangler.toml Reference

```toml
name = "surket"
main = "src/worker.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

assets = { binding = "ASSETS", directory = "../web/dist" }

[[d1_databases]]
binding = "DB"
database_name = "surket"
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"

[[durable_objects.bindings]]
name = "LIVE_TALLY"
class_name = "LiveTallyRoom"

[[migrations]]
tag = "v1"
new_classes = ["LiveTallyRoom"]
```

---

## Option 3 — Vercel (SPA + Serverless API)

Static SPA + serverless API functions.

### Setup

1. Push the repo to GitHub
2. Import in Vercel — build settings are encoded in `vercel.json`

### Build Settings (vercel.json)

- **Build**: `pnpm install && pnpm --filter @surket/web build`
- **Output**: `web/dist`
- `/api/*` routes to the serverless function

### Environment Variables

Set in the Vercel dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_TOKEN` | Your secret | Protects write routes |
| `SURKET_DB` | libSQL/Turso URL | **Required** — file-based SQLite is ephemeral on Vercel |
| `VITE_API_BASE` | _(empty)_ | Same-origin by default |

### Live Tally on Vercel

Serverless functions are short-lived and don't hold WebSocket connections. `/api/config` reports `polling`, and the SPA polls `/results` on `version` changes. For push-based updates, integrate a Cloudflare Durable Object, Upstash, or Ably — the `LiveHub` boundary in `service.ts` is the extension seam.

---

## Comparison Matrix

| Host | Storage | Live Transport | Best For |
|------|---------|---------------|----------|
| **Local/Node** | `node:sqlite` file | WebSocket | Development, single-box hosting |
| **Vercel** | libSQL/Turso | Polling | Static SPA + serverless API |
| **Cloudflare** | D1 | Durable Object (push) | Production, live audience tally |

---

## Verification

Before deploying, verify the data layer:

```bash
pnpm verify
```

This bundles and runs `scripts/verify.ts` — 36 assertions covering schema, seed idempotency, templates, tally correctness, NPS, sentiment/keywords, live broadcast, and survey duplication.

---

## Post-Deployment Checklist

- [ ] Set `ADMIN_TOKEN` (prevents unauthorized writes)
- [ ] Verify `/api/health` returns `{ ok: true }`
- [ ] Create a test event via the dashboard
- [ ] Submit a test response via the join flow
- [ ] Verify live tally updates (WebSocket on CF, polling on Vercel)
- [ ] Configure dark/light mode in Settings
