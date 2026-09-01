// Small dependency-free helpers shared across the server.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** URL/transport-safe unique id with a readable prefix. */
export function id(prefix: string): string {
  let rand = "";
  for (let i = 0; i < 10; i += 1) {
    rand += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Short, human-friendly join code for live audience entry (e.g. "7KQ2"). */
export function joinCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  const base = String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "event";
}

/** Coerce arbitrary input into a trimmed string with a max length. */
export function str(value: unknown, max = 2000): string {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, max);
}

export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

export function clampNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** A minimal validation error carrying an HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function assert(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
