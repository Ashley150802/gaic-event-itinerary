# SURKET.md

Project notes for **Surket** — the all-in-one event itinerary + live survey
platform. _Powered by Lehro Solutions._

This file is a fast orientation for contributors. For depth see:

- [`README.md`](./README.md) — run it locally, env vars, project layout.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data model, HTTP contract, and
  step-by-step recipes for building on top.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel and Cloudflare (D1 + Durable
  Objects).

---

## What changed in this rebuild

Surket grew from a single-page survey demo into a full platform:

- **Itinerary platform.** Events now own an ordered timeline of **segments**
  (keynote / session / workshop / panel / break / networking / survey). Any
  segment can link to a survey so attendees answer on cue.
- **Live tally.** Responses stream to a presenter view over WebSockets with an
  automatic polling fallback (gated on a monotonic `version` cursor).
- **Templates.** One-click **event blueprints** (AI meetup, conference,
  workshop) and **survey templates** (live pulse, NPS, event feedback, product
  concept, workshop feedback).
- **Deeper core surveys.** Eight question types — `single`, `multi`, `rating`,
  `nps`, `scale`, `number`, `date`, `text` — plus richer analytics: averages,
  NPS score, sentiment, keyword extraction, channel + daily breakdowns. Surveys
  support draft/live/paused/closed lifecycle, join codes, duplication, and
  question reordering.
- **Professional, responsive UI.** A dashboard shell with sidebar nav, themeable
  palettes, a builder with live preview, a mobile-first respond flow, and a
  full-screen present mode for the big screen.
- **Runtime-agnostic backend.** A single `Store` contract with SQLite (Node)
  and Cloudflare D1 drivers; a pure analytics engine; one shared Hono app for
  Node, Vercel, and Cloudflare.

## Tech stack

- **Frontend:** React + Vite + TypeScript SPA (`web/`).
- **Backend:** Hono API, Node's built-in `node:sqlite` (Node) / D1 (Cloudflare),
  WebSocket live tally with polling fallback (`server/`). No native modules —
  no Windows Build Tools / C++ compiler needed (requires Node 22.5+).
- **Storage:** SQLite now; D1 / libSQL-Turso for durable production.

## Verified

- SPA bundles cleanly (esbuild).
- Data layer: 36 assertions pass against `node:sqlite` — schema, seed
  idempotency, templates, tally correctness, NPS, sentiment/keywords, live
  broadcast, and duplication. Run `pnpm verify`.
