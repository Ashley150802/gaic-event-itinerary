// Runtime-agnostic HTTP API built on Hono. The SAME app powers the Node server
// (server/src/index.ts) and the Cloudflare Worker (server/src/worker.ts).
//
// Access control: mutating routes require an admin token when `adminToken` is
// set (Authorization: Bearer <token> or x-admin-token: <token>). When no token
// is configured the API runs in open "dev" mode. Public routes: reading events,
// reading live surveys, looking up a survey by join code, and submitting a
// response (so audiences can answer without credentials).

import { Hono } from "hono";
import { getSurveyResults, submitResponse } from "./service.js";
import { applyEventTemplate, applySurveyTemplate, listTemplates } from "./templates.js";
import type { LiveHub } from "./live.js";
import type { Store } from "./types.js";
import { HttpError } from "./util.js";
import { securityHeaders, hardenedCors, rateLimit, bodySizeLimit, requestLogger } from "./security.js";

export interface AppDeps {
  store: Store;
  hub: LiveHub | null;
  adminToken?: string;
  // Optional one-time async init (e.g. lazy DB setup on a serverless cold start).
  // Registered as the very first middleware so it runs before any route handler.
  ensureReady?: () => Promise<void>;
}

export function createApp(deps: AppDeps) {
  const { store, hub, adminToken, ensureReady } = deps;
  const app = new Hono();

  // Security middleware stack (OWASP-aligned)
  app.use("*", requestLogger());
  app.use("*", securityHeaders());
  app.use("*", hardenedCors());
  app.use("/api/*", bodySizeLimit(100_000));
  app.use("/api/*", rateLimit({ windowMs: 60_000, max: 120 }));

  if (ensureReady) {
    app.use("*", async (c, next) => {
      await ensureReady();
      await next();
    });
  }

  const isAdmin = (auth: string | undefined, headerToken: string | undefined): boolean => {
    if (!adminToken) return true; // dev/open mode
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
    return bearer === adminToken || headerToken === adminToken;
  };

  // Guard mutating routes only.
  app.use("/api/*", async (c, next) => {
    const method = c.req.method.toUpperCase();
    const mutating = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
    const path = c.req.path;
    // public mutation: respondents submitting answers
    const isPublicSubmit = method === "POST" && /\/api\/surveys\/[^/]+\/responses$/.test(path);
    // Allow public auth verification even when admin mode is on.
    const isAuthVerify = method === "POST" && path === "/api/auth/verify";
    if (mutating && !isPublicSubmit && !isAuthVerify && !isAdmin(c.req.header("authorization"), c.req.header("x-admin-token"))) {
      return c.json({ error: "Unauthorized. Provide a valid admin token." }, 401);
    }
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    console.error("[surket] unhandled error:", err);
    // Include the real message for debugging; in production the operator can
    // check Worker logs via `wrangler tail`.
    return c.json({ error: "Internal error", detail: err?.message || String(err) }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true, service: "surket", time: new Date().toISOString() }));
  app.get("/api/config", (c) => c.json({ requiresAuth: Boolean(adminToken), liveTransport: hub ? "websocket" : "polling" }));
  app.get("/api/templates", (c) => c.json(listTemplates()));

  // ---- admin auth verification (public — lets the UI confirm a token without exposing it) ----
  app.post("/api/auth/verify", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const candidate: string = (body?.token ?? "").toString().trim();
    if (!adminToken) {
      // No server token configured — everything is open; report accordingly.
      return c.json({ valid: true, open: true, role: "admin" });
    }
    if (!candidate) return c.json({ valid: false, error: "No token provided." });
    const ok = candidate === adminToken;
    return c.json(ok ? { valid: true, role: "admin" } : { valid: false, error: "Invalid token." });
  });

  // ---- events ----
  app.get("/api/events", async (c) => c.json(await store.listEvents()));

  // Keep slug before /api/events/:id so the param route cannot shadow it.
  app.get("/api/events/slug/:slug", async (c) => {
    const event = await store.getEventBySlug(c.req.param("slug"));
    if (!event) return c.json({ error: "Event not found" }, 404);
    const [segments, surveys] = await Promise.all([
      store.listSegments(event.id),
      store.listSurveys(event.id),
    ]);
    return c.json({ event, segments, surveys });
  });

  app.post("/api/events", async (c) => {
    const body = await c.req.json();
    return c.json(await store.createEvent(body), 201);
  });

  app.get("/api/events/:id", async (c) => {
    const event = await store.getEvent(c.req.param("id"));
    if (!event) return c.json({ error: "Event not found" }, 404);
    const [segments, surveys] = await Promise.all([
      store.listSegments(event.id),
      store.listSurveys(event.id),
    ]);
    return c.json({ event, segments, surveys });
  });

  app.patch("/api/events/:id", async (c) => {
    const updated = await store.updateEvent(c.req.param("id"), await c.req.json());
    if (!updated) return c.json({ error: "Event not found" }, 404);
    return c.json(updated);
  });

  app.delete("/api/events/:id", async (c) => {
    const ok = await store.deleteEvent(c.req.param("id"));
    return c.json({ deleted: ok });
  });

  // ---- segments (itinerary) ----
  app.get("/api/events/:id/segments", async (c) => c.json(await store.listSegments(c.req.param("id"))));

  app.post("/api/events/:id/segments", async (c) => {
    const seg = await store.createSegment(c.req.param("id"), await c.req.json());
    if (!seg) return c.json({ error: "Event not found" }, 404);
    return c.json(seg, 201);
  });

  app.patch("/api/segments/:id", async (c) => {
    const seg = await store.updateSegment(c.req.param("id"), await c.req.json());
    if (!seg) return c.json({ error: "Segment not found" }, 404);
    return c.json(seg);
  });

  app.delete("/api/segments/:id", async (c) => c.json({ deleted: await store.deleteSegment(c.req.param("id")) }));

  app.post("/api/events/:id/segments/reorder", async (c) => {
    const body = await c.req.json();
    await store.reorderSegments(c.req.param("id"), body.orderedIds || []);
    return c.json({ ok: true });
  });

  // ---- surveys ----
  app.get("/api/surveys", async (c) => {
    const eventId = c.req.query("eventId");
    return c.json(await store.listSurveys(eventId ?? null));
  });

  app.post("/api/surveys", async (c) => c.json(await store.createSurvey(await c.req.json()), 201));

  app.get("/api/surveys/:id", async (c) => {
    const survey = await store.getSurvey(c.req.param("id"));
    if (!survey) return c.json({ error: "Survey not found" }, 404);
    return c.json(survey);
  });

  app.patch("/api/surveys/:id", async (c) => {
    const survey = await store.updateSurvey(c.req.param("id"), await c.req.json());
    if (!survey) return c.json({ error: "Survey not found" }, 404);
    return c.json(survey);
  });

  app.delete("/api/surveys/:id", async (c) => c.json({ deleted: await store.deleteSurvey(c.req.param("id")) }));

  app.post("/api/surveys/:id/duplicate", async (c) => {
    const survey = await store.duplicateSurvey(c.req.param("id"));
    if (!survey) return c.json({ error: "Survey not found" }, 404);
    return c.json(survey, 201);
  });

  app.get("/api/surveys/:id/results", async (c) => {
    const snapshot = await getSurveyResults(store, c.req.param("id"));
    if (!snapshot) return c.json({ error: "Survey not found" }, 404);
    return c.json(snapshot.results);
  });

  app.get("/api/join/:code", async (c) => {
    const survey = await store.getSurveyByJoinCode(c.req.param("code"));
    if (!survey) return c.json({ error: "No live survey for that code" }, 404);
    return c.json(survey);
  });

  // ---- questions ----
  app.post("/api/surveys/:id/questions", async (c) => {
    const q = await store.createQuestion(c.req.param("id"), await c.req.json());
    if (!q) return c.json({ error: "Survey not found" }, 404);
    return c.json(q, 201);
  });

  app.patch("/api/questions/:id", async (c) => {
    const q = await store.updateQuestion(c.req.param("id"), await c.req.json());
    if (!q) return c.json({ error: "Question not found" }, 404);
    return c.json(q);
  });

  app.delete("/api/questions/:id", async (c) => c.json({ deleted: await store.deleteQuestion(c.req.param("id")) }));

  app.post("/api/surveys/:id/questions/reorder", async (c) => {
    const body = await c.req.json();
    await store.reorderQuestions(c.req.param("id"), body.orderedIds || []);
    return c.json({ ok: true });
  });

  // ---- responses ----
  app.post("/api/surveys/:id/responses", async (c) => {
    const result = await submitResponse(store, hub, c.req.param("id"), await c.req.json());
    if (!result) return c.json({ error: "Survey not found" }, 404);
    return c.json(result, 201);
  });

  app.get("/api/surveys/:id/responses", async (c) => {
    const limit = Number(c.req.query("limit") || 50);
    return c.json(await store.listResponses(c.req.param("id"), limit));
  });

  // ---- template instantiation ----
  const instantiateEventTemplate = async (c: any) => {
    const event = await applyEventTemplate(store, c.req.param("templateId"));
    if (!event) return c.json({ error: "Template not found" }, 404);
    return c.json(event, 201);
  };
  const instantiateSurveyTemplate = async (c: any) => {
    const eventId = c.req.query("eventId") ?? null;
    const survey = await applySurveyTemplate(store, c.req.param("templateId"), eventId);
    if (!survey) return c.json({ error: "Template not found" }, 404);
    return c.json(survey, 201);
  };

  // Plural routes are the documented API. Singular aliases preserve backwards compatibility.
  app.post("/api/templates/events/:templateId", instantiateEventTemplate);
  app.post("/api/templates/surveys/:templateId", instantiateSurveyTemplate);
  app.post("/api/templates/event/:templateId", instantiateEventTemplate);
  app.post("/api/templates/survey/:templateId", instantiateSurveyTemplate);

  return app;
}
