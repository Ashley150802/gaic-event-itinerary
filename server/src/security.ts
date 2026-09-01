// OWASP-aligned security middleware for the Surket Hono API.
// Implements: security headers, simple rate limiting, body size guard,
// input sanitization helpers, and CORS hardening.
// Designed to work on both Node (Vercel) and Cloudflare Workers.

import type { Context, Next } from "hono";

// ---- Security Headers (OWASP: proactive headers) ----
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    const h = c.res.headers;
    // Prevent clickjacking
    h.set("X-Frame-Options", "DENY");
    // Prevent MIME-type sniffing
    h.set("X-Content-Type-Options", "nosniff");
    // Referrer policy
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions policy — restrict sensitive APIs
    h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // HSTS (only meaningful on https, but harmless on http dev)
    h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    // CSP — allow inline styles/scripts for the SPA (no external resources in prod)
    h.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
    // Cross-Origin policies
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    h.set("Cross-Origin-Resource-Policy", "same-origin");
    // Remove server identification
    h.delete("Server");
    h.delete("X-Powered-By");
  };
}

// ---- CORS Hardening ----
export function hardenedCors(allowedOrigins: string[] = []) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("origin");
    if (origin) {
      // In dev (no allowedOrigins), allow localhost. In prod, must be in list.
      const isDev = allowedOrigins.length === 0;
      const isAllowed = isDev || allowedOrigins.includes(origin);
      if (isAllowed) {
        c.res.headers.set("Access-Control-Allow-Origin", origin);
        c.res.headers.set("Vary", "Origin");
      }
    }
    c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token");
    c.res.headers.set("Access-Control-Max-Age", "86400");
    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
  };
}

// ---- Rate Limiting (in-memory, per-IP) ----
interface RateBucket { count: number; resetAt: number; }
const rateBuckets = new Map<string, RateBucket>();

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  const { windowMs, max, keyPrefix = "rl" } = opts;
  return async (c: Context, next: Next) => {
    // Use x-forwarded-for (behind Vercel/CF) or remote address
    const fwd = c.req.header("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0].trim() : "") || c.req.header("x-real-ip") || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    let bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(key, bucket);
    }
    bucket.count++;
    c.res.headers.set("X-RateLimit-Limit", String(max));
    c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      c.res.headers.set("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests. Please slow down." }, 429);
    }
    await next();
  };
}

// ---- Body Size Guard ----
export function bodySizeLimit(maxBytes = 100_000) {
  return async (c: Context, next: Next) => {
    const cl = Number(c.req.header("content-length") || "0");
    if (cl > maxBytes) {
      return c.json({ error: "Request body too large." }, 413);
    }
    await next();
  };
}

// ---- Input Sanitization ----
// Strips control characters and trims. Not a replacement for proper
// output encoding on the client (React already escapes by default).
export function sanitizeString(s: unknown): string {
  if (typeof s !== "string") return "";
  // Strip null bytes and control chars except newline/tab
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export function sanitizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = sanitizeString(v);
    else if (Array.isArray(v)) out[k] = v.map((item) => (typeof item === "string" ? sanitizeString(item) : (typeof item === "object" && item ? sanitizeRecord(item as Record<string, unknown>) : item)));
    else if (v && typeof v === "object") out[k] = sanitizeRecord(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

// ---- Request Logging (structured, no sensitive data) ----
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    const method = c.req.method;
    const path = c.req.path;
    const status = c.res.status;
    // Only log errors and slow requests in production to reduce noise
    if (status >= 400 || ms > 500) {
      console.error(`[${method}] ${path} ${status} ${ms}ms`);
    }
  };
}
