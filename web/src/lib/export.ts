// Client-side data export helpers. All exports are generated in the browser
// from data already fetched via the API, so there is no backend export endpoint
// and no extra server load.

import type { EventRecord, SurveyResults } from "../types";

/** Triggers a browser download of a text blob. */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Converts an array of flat records into CSV text. */
export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
  const head = cols.map(csvCell).join(",");
  const lines = rows.map((r) => cols.map((c) => csvCell(r[c])).join(","));
  return [head, ...lines].join("\n");
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportEventsCsv(events: EventRecord[]): void {
  const rows = events.map((e) => ({
    id: e.id, title: e.title, slug: e.slug, status: e.status, organizer: e.organizer,
    location: e.location, theme: e.theme, startsAt: e.startsAt || "", createdAt: e.createdAt,
  }));
  downloadBlob(`surket-events-${stamp()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
}

export function exportEventsJson(events: EventRecord[]): void {
  downloadBlob(`surket-events-${stamp()}.json`, JSON.stringify(events, null, 2), "application/json");
}

/** Flattens a survey's tally into per-bucket CSV rows. */
export function exportResultsCsv(title: string, results: SurveyResults): void {
  const rows: Array<Record<string, unknown>> = [];
  for (const q of results.questions) {
    if (q.buckets.length === 0) {
      rows.push({ question: q.label, type: q.type, option: "", count: 0, total: q.total });
    }
    for (const b of q.buckets) {
      rows.push({ question: q.label, type: q.type, option: b.label, count: b.value, total: q.total });
    }
  }
  const safe = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "survey";
  downloadBlob(`surket-results-${safe}-${stamp()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
}

export function exportResultsJson(title: string, results: SurveyResults): void {
  const safe = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "survey";
  downloadBlob(`surket-results-${safe}-${stamp()}.json`, JSON.stringify(results, null, 2), "application/json");
}
