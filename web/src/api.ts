// Typed API client. All calls go through `request`, which attaches the admin
// token (if the operator has entered one) and normalises errors.

import type {
  EventDetail,
  EventRecord,
  Question,
  Segment,
  Survey,
  SurveyResults,
  SurveyWithQuestions,
  ResponseWithAnswers,
  TemplateCatalog,
} from "./types";

const API_BASE: string =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) || "";

const TOKEN_KEY = "surket.adminToken";
const AUTH_STATUS_KEY = "surket.authVerified";

export interface AuthVerifyResult {
  valid: boolean;
  role?: string;
  open?: boolean; // true when server has no token configured (open mode)
  error?: string;
}

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
export function setAdminToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Cached auth verification flag — survives page navigation within a session. */
export function getAuthVerified(): boolean {
  try { return sessionStorage.getItem(AUTH_STATUS_KEY) === "1"; } catch { return false; }
}
export function setAuthVerified(v: boolean): void {
  try { sessionStorage.setItem(AUTH_STATUS_KEY, v ? "1" : "0"); } catch { /* ignore */ }
}

export interface SubmitResponseResult {
  response: ResponseWithAnswers;
  results: SurveyResults | null;
}

const enc = (value: string) => encodeURIComponent(value);

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAdminToken();
  if (token) headers["x-admin-token"] = token;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers as any) } });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      // Surface the detail field for debugging (server includes real error message).
      if (body?.detail) message += ` — ${body.detail}`;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const body = (data: unknown) => ({ body: JSON.stringify(data) });

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  config: () => request<{ requiresAuth: boolean; liveTransport: string }>("/api/config"),
  templates: () => request<TemplateCatalog>("/api/templates"),

  /**
   * Verify an admin token against the server.
   * Returns the verification result without exposing the server-side secret.
   */
  verifyToken: (token: string) =>
    request<AuthVerifyResult>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  listEvents: () => request<EventRecord[]>("/api/events"),
  getEvent: (id: string) => request<EventDetail>(`/api/events/${enc(id)}`),
  getEventBySlug: (slug: string) => request<EventDetail>(`/api/events/slug/${enc(slug)}`),
  createEvent: (data: Partial<EventRecord>) => request<EventRecord>("/api/events", { method: "POST", ...body(data) }),
  updateEvent: (id: string, data: Partial<EventRecord>) => request<EventRecord>(`/api/events/${enc(id)}`, { method: "PATCH", ...body(data) }),
  deleteEvent: (id: string) => request<{ deleted: boolean }>(`/api/events/${enc(id)}`, { method: "DELETE" }),

  createSegment: (eventId: string, data: Partial<Segment>) => request<Segment>(`/api/events/${enc(eventId)}/segments`, { method: "POST", ...body(data) }),
  updateSegment: (id: string, data: Partial<Segment>) => request<Segment>(`/api/segments/${enc(id)}`, { method: "PATCH", ...body(data) }),
  deleteSegment: (id: string) => request<{ deleted: boolean }>(`/api/segments/${enc(id)}`, { method: "DELETE" }),
  reorderSegments: (eventId: string, orderedIds: string[]) => request<{ ok: boolean }>(`/api/events/${enc(eventId)}/segments/reorder`, { method: "POST", ...body({ orderedIds }) }),

  listSurveys: (eventId?: string) => request<Survey[]>(`/api/surveys${eventId ? `?eventId=${enc(eventId)}` : ""}`),
  getSurvey: (id: string) => request<SurveyWithQuestions>(`/api/surveys/${enc(id)}`),
  createSurvey: (data: Partial<Survey>) => request<Survey>("/api/surveys", { method: "POST", ...body(data) }),
  updateSurvey: (id: string, data: Partial<Survey> & { isLive?: boolean }) => request<Survey>(`/api/surveys/${enc(id)}`, { method: "PATCH", ...body(data) }),
  deleteSurvey: (id: string) => request<{ deleted: boolean }>(`/api/surveys/${enc(id)}`, { method: "DELETE" }),
  duplicateSurvey: (id: string) => request<SurveyWithQuestions>(`/api/surveys/${enc(id)}/duplicate`, { method: "POST" }),
  surveyResults: (id: string) => request<SurveyResults>(`/api/surveys/${enc(id)}/results`),
  joinSurvey: (code: string) => request<SurveyWithQuestions>(`/api/join/${enc(code)}`),

  createQuestion: (surveyId: string, data: Partial<Question>) => request<Question>(`/api/surveys/${enc(surveyId)}/questions`, { method: "POST", ...body(data) }),
  updateQuestion: (id: string, data: Partial<Question>) => request<Question>(`/api/questions/${enc(id)}`, { method: "PATCH", ...body(data) }),
  deleteQuestion: (id: string) => request<{ deleted: boolean }>(`/api/questions/${enc(id)}`, { method: "DELETE" }),
  reorderQuestions: (surveyId: string, orderedIds: string[]) => request<{ ok: boolean }>(`/api/surveys/${enc(surveyId)}/questions/reorder`, { method: "POST", ...body({ orderedIds }) }),

  submitResponse: (surveyId: string, data: { channel?: string; note?: string; answers: { questionId: string; value: unknown }[] }) =>
    request<SubmitResponseResult>(`/api/surveys/${enc(surveyId)}/responses`, { method: "POST", ...body(data) }),
  listResponses: (surveyId: string, limit = 50) => request<ResponseWithAnswers[]>(`/api/surveys/${enc(surveyId)}/responses?limit=${encodeURIComponent(String(limit))}`),

  applyEventTemplate: (templateId: string) => request<EventRecord>(`/api/templates/events/${enc(templateId)}`, { method: "POST" }),
  applySurveyTemplate: (templateId: string, eventId?: string) =>
    request<SurveyWithQuestions>(`/api/templates/surveys/${enc(templateId)}${eventId ? `?eventId=${enc(eventId)}` : ""}`, { method: "POST" }),
};

export function liveSocketUrl(surveyId: string): string {
  const base = API_BASE || "";
  if (base) {
    return base.replace(/^http/, "ws") + `/api/live?surveyId=${enc(surveyId)}`;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/api/live?surveyId=${enc(surveyId)}`;
}
