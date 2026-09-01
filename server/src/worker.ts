// Cloudflare Workers entry point.
//
// Storage is Cloudflare D1 (createD1Store). The live tally uses a Durable Object
// (`LiveTallyRoom`) that fans out WebSocket messages per survey. The Worker
// serves the API and, via the [site]/assets binding, the built SPA.

import { createApp } from "./app.js";
import { createD1Store, type D1Like } from "./d1Store.js";
import { getSurveyResults, submitResponse } from "./service.js";
import { surveyTopic } from "./live.js";

export interface Env {
  DB: D1Like;
  ADMIN_TOKEN?: string;
  LIVE_TALLY: DurableObjectNamespace;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

// Minimal Durable Object / Workers ambient types (avoid hard dependency).
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
interface DurableObjectId {}
interface DurableObjectStub {
  fetch(req: Request): Promise<Response>;
}
interface DurableObjectState {
  acceptWebSocket?(ws: WebSocket): void;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Live tally WebSocket -> routed to the per-survey Durable Object.
    if (url.pathname === "/api/live") {
      const surveyId = url.searchParams.get("surveyId");
      if (!surveyId) return new Response("surveyId required", { status: 400 });
      const id = env.LIVE_TALLY.idFromName(surveyId);
      return env.LIVE_TALLY.get(id).fetch(request);
    }

    const store = createD1Store(env.DB);

    // Lazy one-time schema init so tables exist even if the D1 migration
    // was never applied externally. CREATE TABLE IF NOT EXISTS is idempotent.
    let initPromise: Promise<void> | null = null;
    const ensureReady = () => {
      if (!initPromise) initPromise = store.init();
      return initPromise;
    };

    // Hook response submission so we can notify the Durable Object to broadcast.
    if (request.method === "POST" && /\/api\/surveys\/[^/]+\/responses$/.test(url.pathname)) {
      const surveyId = url.pathname.split("/")[3];
      const body = await request.json().catch(() => ({ answers: [] }));
      await ensureReady();
      const result = await submitResponse(store, null, surveyId, body as any);
      if (!result) return Response.json({ error: "Survey not found" }, { status: 404 });
      // fan-out via durable object
      const id = env.LIVE_TALLY.idFromName(surveyId);
      await env.LIVE_TALLY.get(id)
        .fetch(new Request("https://do/broadcast", {
          method: "POST",
          body: JSON.stringify({ type: "results", surveyId, results: result.results }),
        }))
        .catch(() => {});
      return Response.json(result, { status: 201 });
    }

    const app = createApp({ store, hub: null, adminToken: env.ADMIN_TOKEN, ensureReady });
    const apiResponse = await app.fetch(request);
    if (apiResponse.status !== 404 || url.pathname.startsWith("/api/")) return apiResponse;

    // Static assets / SPA fallback.
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      // If the asset wasn't found and this isn't an API route, serve the SPA
      // index so client-side routing takes over.
      if (assetRes.status === 404 && !url.pathname.startsWith("/api/")) {
        const indexUrl = new URL("/index.html", url.origin);
        return env.ASSETS.fetch(new Request(indexUrl.toString(), { headers: request.headers }));
      }
      return assetRes;
    }
    return apiResponse;
  },
};

// Durable Object: one instance per surveyId, holds the open WebSockets.
export class LiveTallyRoom {
  private sockets = new Set<WebSocket>();
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/broadcast" || request.method === "POST") {
      const payload = await request.text();
      for (const ws of this.sockets) {
        try {
          ws.send(payload);
        } catch {
          this.sockets.delete(ws);
        }
      }
      return new Response("ok");
    }

    // WebSocket upgrade
    const pair = new (globalThis as any).WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    (server as any).accept();
    this.sockets.add(server as unknown as WebSocket);
    (server as any).addEventListener("close", () => this.sockets.delete(server as unknown as WebSocket));
    return new Response(null, { status: 101, webSocket: client } as any);
  }
}

void surveyTopic;
void getSurveyResults;
