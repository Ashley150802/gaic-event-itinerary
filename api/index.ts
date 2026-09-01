// Vercel serverless API entry (Node runtime).
//
// Vercel rewrites /api/* here (see vercel.json). The SPA is served as static
// files from web/dist. On serverless the live tally degrades gracefully to HTTP
// polling (no persistent WebSocket), which the client already supports.
//
// Storage uses Node's built-in `node:sqlite` (no native module, so deploys need
// no C/C++ build tools). Requires the Vercel function to run Node >= 22.5; if
// the runtime is older than 23.4, set NODE_OPTIONS=--experimental-sqlite.
//
// NOTE on persistence: Vercel's filesystem is ephemeral, so the node:sqlite file
// in /tmp is per-instance and resets on cold start -- great for previews/demos.
// For durable Vercel production, point SURKET_DB at a mounted volume or switch
// the store to Cloudflare D1 / Turso libSQL (see DEPLOYMENT.md). Cloudflare
// Workers + D1 is the recommended durable target.

import { handle } from "hono/vercel";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/src/app.js";
import { createSqliteStore, type SqliteDriver } from "../server/src/sqliteStore.js";
import { seedDemoData } from "../server/src/seed.js";

export const config = { runtime: "nodejs" };

const db = new DatabaseSync(process.env.SURKET_DB || "/tmp/surket.db");
const store = createSqliteStore(db as unknown as SqliteDriver);

let readyPromise: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await store.init();
      if (process.env.SURKET_SEED !== "0") await seedDemoData(store);
    })();
  }
  return readyPromise;
}

const app = createApp({
  store,
  hub: null,
  adminToken: process.env.ADMIN_TOKEN || "",
  ensureReady,
});

export default handle(app);
