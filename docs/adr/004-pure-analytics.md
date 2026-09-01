# ADR-004: Pure Analytics Engine (Zero I/O)

**Status:** Accepted

## Context

Surket computes survey analytics (tallies, averages, NPS, sentiment, keywords, daily timeline) on every read and after every new response. This computation must be:

- **Fast** — the live tally presenter view re-renders on every submission
- **Consistent** — identical results whether running on Node, Cloudflare Workers, or Vercel serverless
- **Testable** — analytics bugs are high-visibility (presented on big screens to audiences)

Traditional approaches embed aggregation logic inside SQL queries or couple it to the ORM/data layer, making it runtime-specific and hard to test in isolation.

## Decision

Implement `aggregate.ts` as a **pure function** with zero I/O:

```typescript
function computeResults(
  survey: SurveyWithQuestions,
  rows: AnswerRow[],
  meta: ResponseMeta[]
): SurveyResults
```

### Properties

1. **No database calls** — all data is passed as arguments. The caller (`service.ts`) fetches rows first, then passes them in.
2. **No framework imports** — no Hono, no React, no Cloudflare bindings. Just TypeScript and standard library.
3. **Deterministic** — same inputs always produce the same output. No timestamps, no random values, no environment reads.
4. **Single composition point** — `service.ts` is the only place that wires `Store` + `aggregate` + `LiveHub`. Both Node (`index.ts`) and Cloudflare (`worker.ts`) call the same `getSurveyResults()` / `submitResponse()`.

### Analytics Computed

| Metric | Logic |
|--------|-------|
| `totalResponses` | Count of unique response IDs in `meta` |
| `completionRate` | Fraction of responses with all required questions answered |
| `averageRating` | Mean of all `rating`-type numeric answers |
| `npsScore` | Promoters (9-10) minus detractors (0-6), normalized to -100..100 |
| `sentiment` | Word-level positive/negative/neutral classification of text answers |
| `keywords` | Top words from text answers, stop-word filtered, frequency-ranked |
| `daily` | Responses-per-day timeline from `meta[].createdAt` |
| `questions[]` | Per-question tallies: bucket counts, averages, NPS breakdown |
| `channels` | Response distribution by channel (web, mobile, etc.) |
| `version` | Monotonic counter = total response count |

## Consequences

- **Positive**: Trivially unit-testable — pass in known rows, assert on the output object. No mocking, no test database, no fixtures.
- **Positive**: Identical behavior across all runtimes — the function doesn't know or care where it runs.
- **Positive**: Easy to extend — adding a new metric (e.g., standard deviation, median) is a new `for` loop in the same file.
- **Positive**: Safe to call on every response submission for live tally — no side effects, no double-writes.
- **Negative**: Full recomputation on every call. For surveys with thousands of responses, this re-processes all rows. Currently acceptable because event surveys rarely exceed a few hundred responses.
- **Negative**: Cannot push computation to the database (e.g., `SELECT COUNT(*)`). All aggregation happens in JavaScript memory.
- **Mitigation**: If scale becomes an issue, the function can be split into incremental reducers that maintain running state, without changing the interface.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| SQL-level aggregation (`GROUP BY`) | Dialect differences between SQLite and D1; harder to test; couples analytics to storage |
| Separate analytics service | Over-engineering for the scale; adds network hop and deployment complexity |
| Streaming/incremental aggregation | Premature optimization; the pure-function approach can be refactored to incremental later without changing callers |
