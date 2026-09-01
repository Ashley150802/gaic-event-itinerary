# ADR-001: Runtime-Agnostic Store Interface

**Status:** Accepted

## Context

Surket must run on three distinct hosts: local Node.js, Vercel serverless functions, and Cloudflare Workers. Each has a different storage primitive (file-based SQLite, libSQL/Turso, Cloudflare D1). Writing separate business logic for each host would triple the maintenance surface and make the analytics code untestable in isolation.

## Decision

Define a single `Store` interface in `server/src/types.ts` with ~30 methods covering all CRUD and analytics queries. Implement it twice:

- `sqliteStore.ts` — against Node's built-in `node:sqlite`
- `d1Store.ts` — against Cloudflare D1's prepared statement API

All business logic (`service.ts`, `aggregate.ts`, `app.ts`) depends only on the `Store` interface — never on a concrete driver.

The SQL schema (`schema.ts`) is written in portable SQL that runs identically on both engines. JSON columns (`options`, `config`) store serialized TEXT, parsed on read by each driver.

## Consequences

- **Positive**: Adding a new storage backend requires implementing one file. No changes to routes, services, or analytics.
- **Positive**: The verification harness (`scripts/verify.ts`) tests the real code path against `node:sqlite` — catches regressions without mocking.
- **Positive**: Same API contract across all hosts — clients never know which runtime serves them.
- **Negative**: Both drivers must maintain SQL parity. D1-specific features (batch API) are used only for optimization, never for correctness.
- **Negative**: The `Store` interface is relatively large (~30 methods). New storage implementations require more boilerplate.
