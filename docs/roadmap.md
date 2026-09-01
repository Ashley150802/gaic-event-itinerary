# Roadmap

A forward-looking view of planned features, improvements, and milestones for Surket. Items are grouped by horizon — near-term (next release), mid-term (next quarter), and long-term (future).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🟢 | Shipped |
| 🔵 | In Progress |
| ⚪ | Planned |
| 🔴 | Blocked / Needs Decision |

---

## Near-Term (Next Release)

### Core Platform

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Dark / Light mode with system preference | 🟢 | CSS custom properties, localStorage, 5 accent themes |
| 2 | Cloudflare deployment (Workers + D1) | 🟢 | Modern assets binding, SPA fallback, wrangler.toml |
| 3 | Runtime-agnostic Store interface | 🟢 | Node sqlite + Cloudflare D1 drivers |
| 4 | Live tally (WebSocket + polling fallback) | 🟢 | Transport-agnostic, works on all hosts |
| 5 | Vercel serverless deployment | 🟢 | Polling-only live tally, zero-config |
| 6 | Comprehensive documentation suite | 🟢 | Architecture, ADR, how-it-works, user guide, API reference |
| 7 | Event templates gallery | 🟢 | Pre-built event + survey blueprints |
| 8 | Public itinerary page | 🟢 | QR-code accessible, timezone-aware |
| 9 | CSV / JSON export | 🟢 | Client-side export, no server dependency |
| 10 | Admin token security | 🟢 | Write-gated mutations, open reads for attendees |

### Polish & UX

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 11 | Smooth theme transitions | 🟢 | CSS transitions on all surfaces |
| 12 | GSAP reveal animations | 🟢 | Scroll-triggered fade-in with IntersectionObserver |
| 13 | Responsive mobile layout | 🟢 | Bottom nav, stacked grids, touch-friendly |
| 14 | Accessibility: reduced-motion support | 🟢 | `prefers-reduced-motion` + manual toggle |
| 15 | QR code sharing | 🟢 | Pure-JS generator, no network dependency |
| 16 | Join code entry screen | 🟢 | Auto-focus, uppercase, monospace input |

---

## Mid-Term (Next Quarter)

### Data & Analytics

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 17 | Incremental aggregation | ⚪ | Avoid full recompute on every response; maintain running tallies |
| 18 | Response filtering | ⚪ | Filter analytics by channel, date range, custom segments |
| 19 | Comparative analytics | ⚪ | Side-by-side survey comparison (e.g., Day 1 vs Day 2) |
| 20 | Word cloud visualization | ⚪ | Canvas-based word cloud from text responses |
| 21 | Sentiment trend over time | ⚪ | Track sentiment shifts across multi-day events |
| 22 | Custom question scoring | ⚪ | Weighted scoring for custom evaluation criteria |

### Collaboration & Access

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 23 | Multi-operator access | ⚪ | Role-based access (admin, editor, viewer) |
| 24 | Operator authentication | ⚪ | OAuth2 / passkey login instead of shared admin token |
| 25 | Event cloning | ⚪ | Duplicate an event with all surveys and segments |
| 26 | Shared dashboards | ⚪ | Public read-only analytics URLs for stakeholders |
| 27 | Audit log | ⚪ | Track who changed what and when |

### Live Experience

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 28 | Live Q&A module | ⚪ | Attendees submit questions, audience upvotes |
| 29 | Live word cloud | ⚪ | Real-time word cloud on presenter screen |
| 30 | Countdown timer | ⚪ | Configurable timer between sessions on presenter view |
| 31 | Audience reactions | ⚪ | Emoji reactions (👏 🔥 ❤️) floating on presenter screen |
| 32 | Multi-survey live mode | ⚪ | Switch between active surveys without leaving presenter view |

---

## Long-Term (Future)

### Platform

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 33 | Plugin / extension system | ⚪ | Custom question types via JS plugins |
| 34 | Webhook integrations | ⚪ | POST results to Slack, Teams, Zapier on survey close |
| 35 | API rate limiting per-survey | ⚪ | Granular rate control for high-traffic events |
| 36 | Multi-tenant mode | ⚪ | Multiple organizations on one instance |
| 37 | White-label branding | ⚪ | Custom logo, colors, domain per organization |
| 38 | Offline-first respondent mode | ⚪ | PWA with offline queue for areas with poor connectivity |

### Advanced Analytics

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 39 | AI-powered insights | ⚪ | LLM-generated summary of survey results |
| 40 | Anomaly detection | ⚪ | Flag unusual response patterns (e.g., ballot stuffing) |
| 41 | Cross-event benchmarking | ⚪ | Compare metrics across events in the same organization |
| 42 | Predictive analytics | ⚪ | Forecast response trends based on historical data |

### Infrastructure

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 43 | Edge caching | ⚪ | CDN-level caching of public pages and analytics snapshots |
| 44 | Database migrations framework | ⚪ | Versioned migration system for schema evolution |
| 45 | Health check endpoint | ⚪ | `/api/health` with dependency status (DB, memory, latency) |
| 46 | Structured logging | ⚪ | JSON-formatted logs with correlation IDs |
| 47 | Docker containerization | ⚪ | Official Docker image for self-hosted deployments |
| 48 | Kubernetes Helm chart | ⚪ | Production-ready K8s deployment with Durable Objects alternative |

---

## Completed Milestones

### v1.0 — Foundation

- [x] Event + Survey + Question CRUD
- [x] 8 question types (rating, single, multi, number, text, nps, scale, date)
- [x] Pure analytics engine (zero I/O)
- [x] Runtime-agnostic Store interface
- [x] Node.js local development (node:sqlite)
- [x] Hono HTTP framework with security stack
- [x] React 19 + Vite 8 frontend
- [x] Custom router (no react-router dependency)

### v1.1 — Live Tally & Deployment

- [x] WebSocket live tally (Node in-process hub)
- [x] Durable Object live tally (Cloudflare)
- [x] Polling fallback (Vercel)
- [x] Live presenter big-screen view
- [x] Cloudflare Workers deployment
- [x] Vercel serverless deployment
- [x] Template gallery

### v1.2 — UX & Theming

- [x] Dark / Light / System color mode
- [x] 5 accent themes with light-mode contrast
- [x] Smooth CSS transitions
- [x] GSAP scroll-reveal animations
- [x] Responsive mobile layout
- [x] Public itinerary page
- [x] QR code sharing
- [x] Comprehensive documentation suite

---

## Contributing

To propose a new feature or change priorities:

1. Open a GitHub issue with the `[feature]` prefix
2. Describe the use case and expected behavior
3. If it's a large change, write an ADR in `docs/adr/` first
4. Submit a pull request referencing the issue

---

## Principles for Prioritization

1. **Attendee experience first** — features that make responding easier get priority
2. **Presenter confidence** — live tally reliability is non-negotiable
3. **Operator efficiency** — reduce clicks to create, manage, and analyze events
4. **Runtime parity** — every feature must work on Node, Cloudflare, and Vercel
5. **Zero-config defaults** — new features should work out of the box without configuration
