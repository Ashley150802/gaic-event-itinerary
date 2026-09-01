# API Reference

Complete HTTP API contract. Base path: `/api`. JSON in, JSON out.

---

## Authentication

When `ADMIN_TOKEN` is configured, **write routes** require one of:
- `Authorization: Bearer <token>`
- `x-admin-token: <token>` header

**Public routes** (no token needed): all GET routes, `POST /api/surveys/:id/responses`, `GET /api/join/:code`.

---

## Endpoints

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness probe: `{ ok, service, time }` |
| `GET` | `/api/config` | Runtime config: `{ requiresAuth, liveTransport }` |

### Templates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List all event + survey templates |
| `POST` | `/api/templates/events/:templateId` | Instantiate an event blueprint |
| `POST` | `/api/templates/surveys/:templateId` | Instantiate a survey template (query: `?eventId=`) |

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | List all events |
| `POST` | `/api/events` | Create event |
| `GET` | `/api/events/slug/:slug` | Get event by slug (with segments + surveys) |
| `GET` | `/api/events/:id` | Get event by ID (with segments + surveys) |
| `PATCH` | `/api/events/:id` | Update event |
| `DELETE` | `/api/events/:id` | Delete event (cascades segments, surveys) |

#### Create/Update Event Body

```json
{
  "title": "string",
  "description": "string",
  "organizer": "string",
  "location": "string",
  "startsAt": "ISO date string | null",
  "theme": "aurora | ember | forest | violet | rose",
  "status": "draft | live | archived",
  "slug": "string"
}
```

### Segments (Itinerary)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events/:id/segments` | List segments for an event |
| `POST` | `/api/events/:id/segments` | Create segment |
| `PATCH` | `/api/segments/:id` | Update segment |
| `DELETE` | `/api/segments/:id` | Delete segment |
| `POST` | `/api/events/:id/segments/reorder` | Reorder: `{ orderedIds: string[] }` |

#### Create/Update Segment Body

```json
{
  "title": "string",
  "kind": "keynote | session | workshop | panel | break | networking | survey",
  "speaker": "string",
  "location": "string",
  "startsAt": "ISO date | null",
  "endsAt": "ISO date | null",
  "description": "string",
  "surveyId": "string | null",
  "position": 0
}
```

### Surveys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/surveys?eventId=ID` | List surveys (optional event filter) |
| `POST` | `/api/surveys` | Create survey |
| `GET` | `/api/surveys/:id` | Get survey with questions |
| `PATCH` | `/api/surveys/:id` | Update survey |
| `DELETE` | `/api/surveys/:id` | Delete survey |
| `POST` | `/api/surveys/:id/duplicate` | Clone survey with questions |
| `GET` | `/api/join/:code` | Resolve join code → survey |
| `GET` | `/api/surveys/:id/results` | Computed `SurveyResults` |

#### Create/Update Survey Body

```json
{
  "title": "string",
  "eventId": "string | null",
  "description": "string",
  "audience": "string",
  "status": "draft | live | paused | closed",
  "mode": "standard | live",
  "isLive": false
}
```

### Questions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/surveys/:id/questions` | Create question |
| `PATCH` | `/api/questions/:id` | Update question |
| `DELETE` | `/api/questions/:id` | Delete question |
| `POST` | `/api/surveys/:id/questions/reorder` | Reorder: `{ orderedIds: string[] }` |

#### Create/Update Question Body

```json
{
  "label": "string",
  "type": "rating | single | multi | number | text | nps | scale | date",
  "required": false,
  "options": ["Option A", "Option B"],
  "config": {
    "min": 0,
    "max": 10,
    "minLabel": "Not likely",
    "maxLabel": "Very likely",
    "step": 1
  },
  "position": 0
}
```

### Responses

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/surveys/:id/responses` | Submit response (**public**) |
| `GET` | `/api/surveys/:id/responses?limit=50` | List responses |

#### Submit Response Body

```json
{
  "channel": "web",
  "note": "",
  "answers": [
    { "questionId": "q1", "value": "Option A" },
    { "questionId": "q2", "value": 4 },
    { "questionId": "q3", "value": ["A", "C"] }
  ]
}
```

`AnswerValue` types: `string` (single/text/date), `number` (rating/nps/scale/number), `string[]` (multi).

### Live Tally (WebSocket)

| Protocol | Path | Description |
|----------|------|-------------|
| `WS` | `/api/live?surveyId=ID` | Subscribe to live results |

Messages: `{ "type": "results", "surveyId": "...", "results": SurveyResults }`

---

## Response Types

### SurveyResults

```typescript
{
  surveyId: string;
  totalResponses: number;
  completionRate: number;       // 0..1
  averageRating: number | null;
  npsScore: number | null;      // -100..100
  sentiment: { positive: number; neutral: number; negative: number };
  questions: QuestionTally[];
  channels: { label: string; value: number }[];
  daily: { label: string; value: number }[];
  keywords: { word: string; count: number }[];
  version: number;              // monotonic — increments per response
}
```

### QuestionTally

```typescript
{
  questionId: string;
  label: string;
  type: QuestionType;
  total: number;
  buckets: { label: string; value: number }[];
  average: number | null;
  npsScore: number | null;
}
```

---

## Error Responses

All errors return JSON: `{ "error": "message" }`

| Status | Meaning |
|--------|---------|
| `400` | Bad request (validation error) |
| `401` | Unauthorized (missing/invalid admin token) |
| `404` | Resource not found |
| `429` | Rate limited (120 req/min) |
| `500` | Internal server error |
