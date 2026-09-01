
---

## Frontend Experience Upgrade (v2.1 — frontend only)

Backend (`server/src/`) is unchanged. This pass only touched `web/src/`.

### Operator Settings (`/settings`)
New dedicated page (sidebar + top bar entry) replacing the old quick token modal:
- **Appearance & brand theme** — 5 theme swatches (Aurora / Ember / Forest / Violet / Rose), Comfortable/Compact density, Reduce-motion toggle. Applied app-wide via `<body>` classes.
- **Admin access** — admin token management (mirrors `api.getAdminToken/setAdminToken`, stored locally under `surket.adminToken`).
- **Event defaults** — default starting template, organizer, location, timezone. These prefill the New event dialog.
- **Live presentation display** — show join QR, show percentages, question text-size scale.
- **Data export** — download all events as CSV or JSON (client-side `Blob`, no backend endpoint).

Settings persist in `localStorage` under `surket.settings` and are served by `web/src/lib/settings.tsx` (`SettingsProvider` / `useSettings`), mounted at the root in `main.tsx`.

### Join experience
- `/join` — redesigned branded landing: big code entry, scan prompt, Surket / Lehro Solutions brand lockup.
- `/j/:code` — NEW full-screen auto-join confirm (opened by scanning a QR). Resolves the survey, shows its title + live open/closed status, and confirms before entering. The present view's QR now encodes this auto-join link.

### Live presentation (`/present/:id`)
Reads operator presentation settings: optional on-screen join QR, per-option percentages next to live counts, and a question-text size scale (`--q-scale`).

### Per-event danger zone (Event workspace → Overview)
Archive / Reopen, Reset to draft, and Delete (behind a typed-DELETE confirm modal).

### Icons — no more emoji
Template cards previously rendered raw emoji from backend template data (`t.icon`). They now render crisp inline SVGs via `TemplateIcon` (mapped by template id, then category). A full source audit confirms zero emoji glyphs remain in the rendered frontend.

### New / changed routes
`/settings` (shell), `/j/:code` (full screen). Existing: `/`, `/templates`, `/join`, `/events/:id`, `/surveys/:id`, `/present/:id`, `/r/:id`, `/e/:slug`.

### Verification
- SPA bundle: clean (esbuild, ~1.27 MB dev bundle).
- Backend data harness: 36/36. QR self-test: 13/13.

---

## v3 — Production Polish: Visual Overhaul, Timezones, OWASP Security (17 Jun 2026)

### Visual & Animation Overhaul (`web/src/styles.css` — fully rewritten)
- **Animated ambient background**: floating gradient orbs with 24s drift animation, subtle SVG noise texture overlay.
- **Glassmorphic sidebar**: `backdrop-filter: blur(12px)`, gradient with accent tint, active nav indicator with glow.
- **Card hover lift**: border glow + shadow on hover, staggered entrance animations (card-in keyframe with nth-child delays).
- **Custom animated buttons**: shimmer sweep on hover (translateX gradient), press depth (translateY+scale), icon nudge on hover, primary button glow shadow.
- **Enhanced inputs**: focus state with ring + background shift.
- **Tabs**: sliding glow indicator, hover lift.
- **Options/choices**: hover slide-right effect, bounce transitions on scale buttons, star rating bounce.
- **Toast bounce-in**: spring animation.
- **Modal**: backdrop fade + spring scale-in.
- **Timeline nodes**: glow ring, hover scale.
- **Bar fills**: shimmer animation overlay.
- **Scroll reveal**: existing `useReveal` + `card-in` staggered across grids.
- **Custom scrollbar**: themed with accent hover.
- **Reduced motion**: all animations disabled when `prefers-reduced-motion` or operator toggle.

### Real Timezone Support (`web/src/lib/timezone.ts` — new file)
- **200+ IANA timezones** grouped by region (Africa, America, Europe, Asia, Australia/Pacific, Antarctica).
- `detectTimezone()` — auto-detects browser timezone via `Intl.DateTimeFormat`.
- `formatInZone(iso, tz, options?)` — DST-aware formatting using `Intl.DateTimeFormat`.
- `formatDateInZone(iso, tz)` / `formatTimeInZone(iso, tz)` — convenience wrappers.
- `zoneOffsetLabel(tz)` — short offset label (e.g. "GMT+2").
- `localNowInZone(tz)` — current time in a given zone.
- **Wired into**: Settings (timezone picker with grouped `<optgroup>` select + "Detect my timezone" button), EventWorkspace (event date/time + itinerary times), PublicItinerary (header day, now/next times, timeline times).
- Settings default timezone auto-detected on first load.

### OWASP 2026 Security Hardening (`server/src/security.ts` — new file)
- **Security headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS with preload), `Content-Security-Policy` (strict, frame-ancestors: none), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, removes `Server`/`X-Powered-By`.
- **Hardened CORS**: origin allowlist (dev allows localhost, prod requires explicit list), proper `Vary: Origin`.
- **Rate limiting**: in-memory per-IP buckets (120 req/min), returns 429 with `Retry-After`, `X-RateLimit-*` headers.
- **Body size guard**: rejects payloads >100KB with 413.
- **Input sanitization**: `sanitizeString()` strips control chars/null bytes, `sanitizeRecord()` recursively cleans objects.
- **Request logging**: structured logging for errors and slow requests (>500ms).
- All middleware wired into `createApp()` in `app.ts` — applies to both Node/Vercel and Cloudflare Workers.

### Files changed
- **New**: `web/src/lib/timezone.ts`, `server/src/security.ts`
- **Rewritten**: `web/src/styles.css` (complete overhaul)
- **Edited**: `server/src/app.ts` (security middleware), `web/src/pages/Settings.tsx` (timezone picker), `web/src/pages/EventWorkspace.tsx` (timezone formatting), `web/src/pages/PublicItinerary.tsx` (timezone formatting)

### Verification
- SPA bundle: clean (esbuild, exit 0).
- Backend data harness: 36/36.
- QR self-test: 13/13.
- Emoji audit: zero glyphs in frontend source.

---

## v4 — React Bits Integration: Immersive Animations (17 Jun 2026)

### New React Bits Components (all self-contained, zero external deps)
All five components were adapted to use only React + CSS (no GSAP/motion/framer needed),
making them deploy-ready on Vercel + Cloudflare with no new dependencies.

1. **ColorBends** — animated gradient mesh with floating orbs + film grain
2. **SplitText** — scroll-triggered char/word reveal via IntersectionObserver
3. **Counter** — RAF count-up + CSS digit strip transform
4. **FlowingMenu** — hover-reveal marquee nav with edge detection
5. **CardNav** — card-style nav with gradient active state + hover lift

### Creative Integration — Admin UI
- Dashboard: SplitText on page title, Counter on stat tiles
- Layout sidebar: ColorBends ambient orb background
- LivePresent: ColorBends background + Counter on response total

### Creative Integration — End User UI
- Join screen: ColorBends orbs + SplitText heading
- PublicItinerary: ColorBends ambient background + SplitText event title

### Verification
- SPA build: clean | Backend: 36/36 | QR: 13/13 | Emoji: zero
