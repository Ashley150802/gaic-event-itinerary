// Node / Vercel entry point.
//
// Uses Node's built-in `node:sqlite` (no native module, no build tools) + a `ws`
// WebSocket server for the live tally (with an HTTP polling fallback already
// built into the client). Serves the
// built SPA from ../../web/dist when present, so a single process can host both
// the API and the front-end.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Server as HttpServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { WebSocketServer, type WebSocket } from "ws";
import { createApp } from "./app.js";
import { createSqliteStore, type SqliteDriver } from "./sqliteStore.js";
import { liveHub, surveyTopic } from "./live.js";
import { seedDemoData } from "./seed.js";
import { getSurveyResults } from "./service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DB_PATH = process.env.SURKET_DB || join(__dirname, "..", "surket.db");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const WEB_DIST = join(__dirname, "..", "..", "web", "dist");

async function main() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  const store = createSqliteStore(db as unknown as SqliteDriver);
  await store.init();

  if (process.env.SURKET_SEED !== "0") {
    await seedDemoData(store);
  }

  const app = createApp({ store, hub: liveHub, adminToken: ADMIN_TOKEN });

  // Serve the built SPA (if it has been built) and fall back to index.html for
  // client-side routes.
  if (existsSync(WEB_DIST)) {
    app.use("/*", serveStatic({ root: WEB_DIST }));
    app.get("*", serveStatic({ path: "index.html", root: WEB_DIST }));
  }

  // @hono/node-server owns server.listen(). `serve()` returns the listening
  // HTTP server, which is then shared with the WebSocketServer.
  const server = serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\n  Surket server ready`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  admin auth: ${ADMIN_TOKEN ? "enabled" : "OPEN (set ADMIN_TOKEN to lock down)"}\n`);
  }) as unknown as HttpServer;

  // ---- live tally WebSocket ----
  const wss = new WebSocketServer({ server, path: "/api/live" });
  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const surveyId = url.searchParams.get("surveyId");
    if (!surveyId) {
      ws.close(1008, "surveyId required");
      return;
    }
    const topic = surveyTopic(surveyId);
    const unsubscribe = liveHub.subscribe(topic, (payload) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
    });
    // push an initial snapshot on connect
    getSurveyResults(store, surveyId)
      .then((snapshot) => {
        if (snapshot && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "results", surveyId, results: snapshot.results }));
        }
      })
      .catch(() => {});
    ws.on("close", unsubscribe);
    ws.on("error", unsubscribe);
  });
}

main().catch((err) => {
  console.error("Failed to start Surket server:", err);
  process.exit(1);
});
