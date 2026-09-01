# How It Works

A technical deep dive into every subsystem in Surket.

---

## 1. Storage Layer

### The Store Interface

The `Store` interface (`server/src/types.ts`) is the single contract between business logic and the database. It defines ~30 methods covering CRUD for events, segments, surveys, questions, and responses, plus analytics helpers (`getAnswerRows`, `getResponseMeta`, `countResponses`).

### SQLite Driver (Node)

`sqliteStore.ts` implements `Store` against Node's built-in `node:sqlite` module:

- **No native modules** — `node:sqlite` ships with Node 22.5+ (unflagged from 23.4+)
- The driver opens a single file (default `./surket.db`) and runs portable SQL
- Schema is applied lazily on first `init()` call via `SCHEMA_SQL` from `schema.ts`
- `options` and `config` columns store JSON as TEXT, parsed on read

### D1 Driver (Cloudflare)

`d1Store.ts` implements the same `Store` interface against Cloudflare D1:

- Uses D1's prepared statement API (`db.prepare(sql).bind(...).all()`)
- Same portable SQL — no dialect differences between SQLite and D1
- Batch operations use D1's `db.batch()` for atomicity

### Schema

Six tables, all portable SQL:

```
events → segments (itinerary, ordered by position)
events → surveys → questions (ordered by position)
       surveys → responses → answers (keyed by question_id)
```

Foreign keys use `ON DELETE CASCADE` for segments, questions, responses, answers, and `ON DELETE SET NULL` for the survey→event relationship.

Indexes cover all join and sort patterns: `(event_id, position)`, `(survey_id, position)`, `(survey_id, created_at)`, etc.

---

## 2. Analytics Engine

`aggregate.ts` is a **pure function** — zero I/O, fully deterministic.

### Input

- A `SurveyWithQuestions` (survey + its questions)
- An array of `AnswerRow` (questionId, value, createdAt)
- Response metadata (`{ createdAt, channel }[]`)

### Output: `SurveyResults`

| Field | Description |
|-------|-------------|
| `totalResponses` | Count of unique responses |
| `completionRate` | Fraction of responses that answered all required questions (0..1) |
| `averageRating` | Mean of all `rating`-type answers, or `null` |
| `npsScore` | Net Promoter Score (-100..100) from `nps` questions |
| `sentiment` | `{ positive, neutral, negative }` from text analysis |
| `questions[]` | Per-question tallies with buckets, averages, NPS |
| `channels` | Response distribution by channel (web, mobile, etc.) |
| `daily` | Responses per day timeline |
| `keywords` | Top words from text answers (stop-word filtered) |
| `version` | Monotonic counter — increments on every new response |

### Question Type Analytics

| Type | Analytics |
|------|-----------|
| `single` | Bucket counts per option |
| `multi` | Bucket counts (respondents can pick multiple) |
| `rating` | Bucket counts + `average` |
| `nps` | NPS score (-100..100): promoters minus detractors |
| `scale` | Bucket counts + `average` |
| `number` | Bucket counts + `average` |
| `date` | Bucket counts per unique date |
| `text` | Keyword extraction (tokenize, stop-word filter, count) |

### Sentiment Analysis

Text answers are scored using a built-in word list:
- **Positive words** (great, excellent, love, etc.) increment `positive`
- **Negative words** (bad, poor, terrible, etc.) increment `negative`
- All others are `neutral`

This is intentionally simple — no ML dependency, no external API calls.

---

## 3. Live Tally System

### Flow

1. **Respondent** submits via `POST /api/surveys/:id/responses`
2. **service.ts** calls `store.createResponse()`, then `store.getAnswerRows()`, then `aggregate()`
3. The new `SurveyResults` (with bumped `version`) is published to the live hub
4. **Presenter screen** receives it via WebSocket (or polling fallback)

### Node: In-Process LiveHub

`live.ts` exports a `LiveHub` class — an in-memory pub/sub:

```
subscribe(topic, ws)  →  ws receives messages published to topic
publish(topic, data)  →  all subscribers get the data
```

The Node entry (`index.ts`) creates a `LiveHub` and passes it to `createApp`. Each WebSocket connection to `/api/live?surveyId=X` subscribes to `surveyTopic(surveyId)`.

### Cloudflare: Durable Objects

`worker.ts` defines `LiveTallyRoom` — a Durable Object class:

- One instance per `surveyId` (addressed via `idFromName`)
- Holds a `Set<WebSocket>` of connected presenter screens
- On broadcast: iterates all sockets and sends the payload
- WebSocket upgrade happens in the `fetch()` handler via `WebSocketPair`

### Polling Fallback

`useLiveTally.ts` (React hook) implements the client-side transport selection:

1. On mount, calls `GET /api/config` to check `liveTransport`
2. If `"websocket"`: opens `ws://host/api/live?surveyId=X`, listens for messages
3. If `"polling"` (or WS fails): polls `GET /api/surveys/:id/results` every 3 seconds
4. In both cases, the UI only re-renders when `version` increases — preventing flicker

---

## 4. Template System

Templates are **in-memory blueprints** defined in `server/src/templates.ts`:

### Survey Templates

Each entry has: `id`, `name`, `description`, `audience`, `mode`, and a `questions[]` array with type, label, options, and config.

Built-in templates:
- **Live Pulse** — 4-question real-time feedback
- **Event Feedback** — post-event satisfaction
- **NPS Pulse** — Net Promoter Score focus
- **Product Concept** — feature validation
- **Workshop Feedback** — session-specific feedback

### Event Templates

Each entry has: `id`, `name`, `theme`, `status`, `segments[]` (itinerary), and `surveys[]` (referencing survey template IDs).

Built-in templates:
- **AI Meetup** — keynote + workshop + networking + live survey
- **Conference** — full-day multi-track schedule
- **Workshop** — hands-on session with feedback survey

### Instantiation

`POST /api/templates/events/:templateId` → calls `applyEventTemplate()` which:
1. Creates the event from the blueprint
2. Creates each segment
3. Instantiates linked survey templates
4. Returns the full `EventDetail`

`POST /api/templates/surveys/:templateId` → calls `applySurveyTemplate()` which creates a survey with pre-populated questions.

---

## 5. Frontend Router

`web/src/router.tsx` is a **zero-dependency** History API router:

- `RouterProvider` wraps the app and listens for `popstate` events
- `navigate(to, { replace? })` calls `history.pushState` / `replaceState`
- `Link` component intercepts clicks (ignoring modifier keys) and calls `navigate`
- `matchRoute(pattern, path)` matches `:param` patterns against the current URL

### Route Table

**Full-screen routes** (no app shell):
- `/present/:id` → LivePresent (big-screen tally)
- `/r/:id` → Respond (attendee survey form)
- `/e/:slug` → PublicItinerary (public timeline)
- `/j/:code` → JoinConfirm (join code redirect)

**Shell routes** (sidebar + topbar):
- `/` → Dashboard
- `/templates` → Templates gallery
- `/join` → Join a survey
- `/settings` → Operator settings
- `/events/:id` → EventWorkspace
- `/surveys/:id` → SurveyBuilder

---

## 6. Settings & Theme System

`web/src/lib/settings.tsx` manages operator preferences:

### State

```typescript
interface OperatorSettings {
  theme: ThemeName;           // "aurora" | "ember" | "forest" | "violet" | "rose"
  colorMode: ColorMode;       // "dark" | "light" | "system"
  density: Density;           // "comfortable" | "compact"
  reduceMotion: boolean;
  defaultTemplateId: string;
  defaultOrganizer: string;
  defaultLocation: string;
  defaultTimezone: string;
  presentation: {
    showQr: boolean;
    fontScale: number;        // 0.85 - 1.4
    showPercentages: boolean;
  };
}
```

### Persistence

Stored in `localStorage` under key `surket.settings`. Loaded synchronously on mount via `loadSettings()`.

### Application to DOM

`applyToBody()` runs in a `useEffect` whenever settings change:
1. Swaps `theme-{id}` class on `<body>` for accent theme
2. Sets `data-color-mode` attribute on `<html>` for dark/light
3. Toggles `density-compact` class for spacing
4. Toggles `force-reduce-motion` class for accessibility
5. Updates `<meta name="theme-color">` for mobile browser chrome

### System Color Mode

When `colorMode === "system"`:
- Checks `window.matchMedia("(prefers-color-scheme: light)")` to resolve the actual mode
- Registers a `change` listener so the UI switches automatically when the OS preference changes

---

## 7. Security Stack

`server/src/security.ts` provides five middleware functions:

| Middleware | What it does |
|-----------|-------------|
| `requestLogger()` | Logs method, path, status, duration for every request |
| `securityHeaders()` | Sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection |
| `hardenedCors()` | Environment-aware CORS: permissive in dev, strict in production |
| `bodySizeLimit(bytes)` | Rejects request bodies exceeding the limit (100KB default) |
| `rateLimit({ windowMs, max })` | Per-IP request throttle (120 requests per 60 seconds) |

These are applied in order before any route handler runs.
