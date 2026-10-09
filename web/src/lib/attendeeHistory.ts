import type { ResponseWithAnswers } from "../types";

const HISTORY_KEY = "gaic.attendeeResponseHistory.v1";

export interface AttendeeHistoryAnswer {
  label: string;
  value: ResponseWithAnswers["answers"][string];
}

export interface AttendeeHistoryEntry {
  responseId: string;
  surveyId: string;
  eventId: string | null;
  surveyTitle: string;
  submittedAt: string;
  answers: AttendeeHistoryAnswer[];
  note: string;
}

function isHistoryEntry(value: unknown): value is AttendeeHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.responseId === "string"
    && typeof entry.surveyId === "string"
    && (typeof entry.eventId === "string" || entry.eventId === null)
    && typeof entry.surveyTitle === "string"
    && typeof entry.submittedAt === "string"
    && typeof entry.note === "string"
    && Array.isArray(entry.answers)
    && entry.answers.every((answer: unknown) => {
      if (typeof answer !== "object" || answer === null) return false;
      const item = answer as Record<string, unknown>;
      return typeof item.label === "string"
        && (typeof item.value === "string" || typeof item.value === "number" ||
          (Array.isArray(item.value) && item.value.every((option) => typeof option === "string")));
    });
}

export function getAttendeeHistory(): AttendeeHistoryEntry[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isHistoryEntry)) {
    throw new Error("Saved response history is not in a readable format.");
  }
  return parsed;
}

export function saveAttendeeHistoryEntry(entry: AttendeeHistoryEntry): void {
  const history = getAttendeeHistory().filter((item) => item.responseId !== entry.responseId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...history]));
}

export function clearAttendeeHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
