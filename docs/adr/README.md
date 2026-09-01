# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for Surket. Each ADR captures a significant technical decision with context, reasoning, and consequences.

---

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./001-runtime-agnostic-store.md) | Runtime-Agnostic Store Interface | Accepted |
| [ADR-002](./002-node-sqlite-no-native.md) | Node's Built-in SQLite (Zero Native Modules) | Accepted |
| [ADR-003](./003-live-tally-transport.md) | Live Tally Transport Strategy | Accepted |
| [ADR-004](./004-pure-analytics.md) | Pure Analytics Engine (Zero I/O) | Accepted |
| [ADR-005](./005-dark-light-mode.md) | Dark/Light Mode via CSS Custom Properties | Accepted |

---

## ADR Format

Each ADR follows a lightweight structure:

1. **Title** — short noun phrase
2. **Status** — Proposed / Accepted / Deprecated / Superseded
3. **Context** — what forces are at play
4. **Decision** — what we decided
5. **Consequences** — what follows from the decision
