# ADR-002: Node's Built-in SQLite (Zero Native Modules)

**Status:** Accepted

## Context

Traditional Node.js SQLite libraries (`better-sqlite3`, `sqlite3`) require C/C++ compilation, Python, and platform-specific build tools. This creates friction for contributors on Windows (needs Visual Studio Build Tools), slows CI/CD, and breaks on edge runtimes that don't support native modules.

Node.js 22.5+ ships `node:sqlite` as a built-in module (unflagged from 23.4+), providing the same SQLite engine without any native compilation step.

## Decision

Use Node's built-in `node:sqlite` exclusively. The `dev` and `start` scripts pass `--experimental-sqlite` so Node 22.5–23.3 also works. From Node 23.4+, the flag is unnecessary but harmless.

The `sqliteStore.ts` driver wraps `node:sqlite`'s synchronous API in the async `Store` interface, maintaining parity with `d1Store.ts`.

## Consequences

- **Positive**: `pnpm install` never compiles anything. Zero C/C++ toolchain dependency.
- **Positive**: Works on Windows without Visual Studio Build Tools, Python, or any compiler.
- **Positive**: Same binary, same SQLite version across all Node installations — no version drift.
- **Positive**: `scripts/verify.ts` can run against the same engine in CI without test-specific setup.
- **Negative**: `node:sqlite` API differs from `better-sqlite3` (e.g., `DatabaseSync` vs `Database`). Cannot share code with `better-sqlite3`-based projects.
- **Negative**: Requires Node 22.5+ minimum. Older Node versions are unsupported.
- **Negative**: `node:sqlite` was experimental in early 22.x releases. The `--experimental-sqlite` flag is required for 22.5–23.3.
