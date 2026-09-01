# Architecture & "build-on-top" guide

This document is the contract for anyone building on top of Surket. It explains
the data model, the runtime-agnostic boundaries, the HTTP API, and step-by-step
recipes for the most common extensions.

---

## 1. Design principles

1. **One Store contract, many drivers.** All data access goes through the
   `Store` interface (`server/src/types.ts`). `sqliteStore.ts` (Node /
   Node's built-in `node:sqlite`) and `d1Store.ts` (Cloudflare D1) both
   implement it. Swapping storage never touches business logic.
2. **Pure analytics.** `aggregate.ts` has zero I/O. Given a survey + answer rows
   it returns `SurveyResults`. That makes it deterministic and trivially
   testable (see `scripts/verify.ts`).
3. **One composition layer.** `service.ts` is the only place that wires Store +
   aggregate + live hub together. Both the Node server and the Cloudflare worker
   call the same `getSurveyResults` / `submitResponse`, so behaviour is
   identical across runtimes.
4. **Framework at the edges only.** Hono routing lives in `app.ts`; the entries
   (`index.ts`, `worker.ts`, `api/index.ts`) just construct a Store + hub and
   hand them to `createApp`. The Node entries use Node's built-in `node:sqlite`,
   so there is no native module and no build toolchain requirement.

```
           HTTP (Hono)                 pure
  client -> app.ts -> service.ts -> aggregate.ts
                          |
                          v
                       Store  ---- sqliteStore.ts (Node)
                          \\---- d1Store.ts (Cloudflare)
                          |
                          v
                       LiveHub (in-proc) / Durable Object (CF)
```

---

## 2. Domain model

All types live in `server/src/types.ts`.

- **Event** — the container. `status: draft | live | archived`, a `theme`, an
  `organizer`, a `slug`.
- **Segment** — one itinerary entry belonging to an event. Ordered by
  `position`. `kind: keynote | session | workshop | panel | break | networking |
  survey`. A segment may set `surveyId` to link a survey (typically `survey`
  kind).
- **Survey** — a set of questions. `status: draft | live | paused | closed`,
  `mode: standard | live`, an `isLive` flag, and a short `joinCode` attendees
  type in to respond. May belong to an event (`eventId`) or stand alone.
- **Question** — `type: rating | single | multi | number | text | nps | scale |
  date`, plus `options[]` and an extensible `config` (`min`, `max`, `minLabel`,
  `maxLabel`, `step`).
- **Response / Answer** — a response holds answers keyed by question id;
  `AnswerValue = string | number | string[]`.
- **SurveyResults** — computed analytics: per-question tallies, `averageRating`,
  `npsScore`, `sentiment`, `channels`, `daily` timeline, `keywords`, and a
  monotonic `version` (the live-tally cursor — it increments on every recorded
  response).

---

## 3. HTTP API contract

Base path: `/api`. JSON in, JSON out. Write routes require `x-admin-token` when
`ADMIN_TOKEN` is configured; read + respond routes are always public.

### Config / live

| Method | Path           | Notes                                                      |
| ------ | -------------- | ---------------------------------------------------------- |
| GET    | `/api/health`  | Liveness probe.                                            |
| GET    | `/api/config`  | Returns `{ transport: "websocket" \| "polling" }`.         |
| WS     | `/api/live?surveyId=ID` | Subscribe; receives `{ type: "results", surveyId, results }`. |

### Templates

| Method | Path                            | Notes                                |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/api/templates`                | Catalog of event + survey templates. |
| POST   | `/api/templates/events/:id`     | Instantiate an event blueprint.      |
| POST   | `/api/templates/surveys/:id`    | Instantiate a survey template (optional `eventId`). |

Singular aliases (`/api/templates/event/:id`, `/api/templates/survey/:id`) are kept for backwards compatibility, but the plural routes above are the canonical contract.

### Events & itinerary

| Method | Path                                  |
| ------ | ------------------------------------- |
| GET    | `/api/events`                         |
| POST   | `/api/events`                         |
| GET    | `/api/events/:id`                     |
| PATCH  | `/api/events/:id`                     |
| DELETE | `/api/events/:id`                     |
| GET    | `/api/events/:id/segments`            |
| POST   | `/api/events/:id/segments`            |
| PATCH  | `/api/segments/:id`                   |
| DELETE | `/api/segments/:id`                   |
| POST   | `/api/events/:id/segments/reorder`    | Body: `{ orderedIds: string[] }`     |

### Surveys, questions, responses

| Method | Path                                   |
| ------ | -------------------------------------- |
| GET    | `/api/surveys?eventId=ID`              |
| POST   | `/api/surveys`                         |
| GET    | `/api/surveys/:id`                     |
| PATCH  | `/api/surveys/:id`                     |
| DELETE | `/api/surveys/:id`                     |
| POST   | `/api/surveys/:id/duplicate`           |
| GET    | `/api/join/:code`                      | Resolve a join code to a survey.     |
| POST   | `/api/surveys/:id/questions`           |
| PATCH  | `/api/questions/:id`                   |
| DELETE | `/api/questions/:id`                   |
| POST   | `/api/surveys/:id/questions/reorder`   | Body: `{ orderedIds: string[] }`     |
| GET    | `/api/surveys/:id/results`             | Computed `SurveyResults`.            |
| POST   | `/api/surveys/:id/responses`           | Body: `{ channel?, note?, answers: [{ questionId, value }] }` |

> The exact response shapes are the exported TypeScript types in
> `server/src/types.ts`. Treat those types as the source of truth.

---

## 4. Extension recipes

### A. Add a new question type

1. Add the literal to `QuestionType` in `types.ts`.
2. Teach the analytics engine how to tally it in `aggregate.ts`
   (`tallyQuestion` + the `isNumericType` helper if it is numeric).
3. Render input + result in the SPA: `web/src/components/QuestionInput.tsx`
   (capture) and the results views (`charts.tsx`).
4. Add a label to `QUESTION_TYPE_LABELS` in `web/src/components/ui.tsx`.
5. Add an assertion in `scripts/verify.ts` and run `pnpm verify`.

No storage changes are needed — answers are stored generically.

### B. Add a template

Edit `server/src/templates.ts`:

- A **survey template** is an entry in `surveyTemplates` (`id`, `name`,
  `description`, `audience`, `mode`, `questions[]`).
- An **event template** is an entry in `eventTemplates` (`id`, `name`,
  `theme`, `status`, `segments[]`, `surveys[]` referencing survey-template ids).

They appear in `/api/templates` and the SPA Templates gallery automatically.

### C. Add an API route

Add the handler in `server/src/app.ts` using the injected `store`, `hub`, and
`service` helpers. Because `createApp` is shared, the route works on Node,
Vercel, and Cloudflare with no further wiring.

### D. Swap or add a storage backend

Implement the `Store` interface against your database, mirroring
`sqliteStore.ts`. Wire it into an entry point. Nothing else changes — the
service layer and analytics are storage-agnostic.

### E. Add a SPA screen

Routes are declared in `web/src/App.tsx` against the tiny history router in
`web/src/router.tsx`. Add a path, point it at a page component under
`web/src/pages/`, and call the typed client in `web/src/api.ts`.

---

## 5. Live tally internals

- `GET /api/config` tells the client which transport to use.
- **Node / Vercel-with-WS:** the `LiveHub` (`live.ts`) is an in-process
  pub/sub. `submitResponse` recomputes results and publishes to
  `surveyTopic(surveyId)`; subscribed WebSocket clients receive the snapshot.
- **Cloudflare:** a `LiveTallyRoom` Durable Object fans out per survey.
- **Fallback:** if a WebSocket cannot be established, `web/src/hooks/useLiveTally.ts`
  polls `/results` and advances only when `version` increases, so the UI never
  flickers or double-counts.

This is why `version` exists on `SurveyResults`: it is the single source of
truth for "has anything changed?" across both transports.
