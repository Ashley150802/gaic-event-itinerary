// Seed a demo workspace so a fresh install shows a populated dashboard, a live
// itinerary, and surveys that already have responses to tally.

import { applyEventTemplate } from "./templates.js";
import type { AnswerInput, Store } from "./types.js";

const CHANNELS = ["web", "web", "web", "mobile", "kiosk"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export async function seedDemoData(store: Store): Promise<void> {
  const existing = await store.listEvents();
  if (existing.length > 0) return; // idempotent: only seed an empty store

  const event = await applyEventTemplate(store, "ai-meetup");
  if (!event) return;

  await store.updateEvent(event.id, {
    title: "Founders & Builders AI Meetup",
    organizer: "GAIC",
    location: "Cape Town",
    status: "live",
  });

  const surveys = await store.listSurveys(event.id);

  const pulse = surveys.find((s) => s.mode === "live");
  if (pulse) {
    await store.updateSurvey(pulse.id, { status: "live", isLive: true });
    const full = await store.getSurvey(pulse.id);
    const q = full?.questions[0];
    if (q) {
      const distribution = ["Energised", "Energised", "Energised", "Curious", "Curious", "Neutral", "Lost"];
      for (let i = 0; i < 24; i += 1) {
        await store.createResponse(pulse.id, {
          channel: pick(CHANNELS, i),
          answers: [{ questionId: q.id, value: pick(distribution, i) }],
        });
      }
    }
  }

  const feedback = surveys.find((s) => s.title.toLowerCase().includes("feedback"));
  if (feedback) {
    await store.updateSurvey(feedback.id, { status: "live" });
    const full = await store.getSurvey(feedback.id);
    if (full) {
      const ratingQ = full.questions.find((q) => q.type === "rating");
      const npsQ = full.questions.find((q) => q.type === "nps");
      const sessionQ = full.questions.find((q) => q.type === "single");
      const textQ = full.questions.find((q) => q.type === "text");
      const ratings = [5, 5, 4, 4, 3, 5, 4, 2, 5, 4];
      const nps = [10, 9, 8, 7, 9, 10, 6, 8, 9, 10];
      const sessions = ["Keynote", "Workshop", "Panel", "Keynote", "Networking"];
      const notes = [
        "Loved the keynote, very inspiring and clear.",
        "Great event but the venue was a bit cold.",
        "Fantastic demos, would recommend to my team.",
        "The panel felt rushed and confusing at times.",
        "Excellent networking, met some brilliant founders.",
      ];
      for (let i = 0; i < 10; i += 1) {
        const answers: AnswerInput[] = [];
        if (ratingQ) answers.push({ questionId: ratingQ.id, value: pick(ratings, i) });
        if (npsQ) answers.push({ questionId: npsQ.id, value: pick(nps, i) });
        if (sessionQ) answers.push({ questionId: sessionQ.id, value: pick(sessions, i) });
        if (textQ && i < notes.length) answers.push({ questionId: textQ.id, value: notes[i] });
        await store.createResponse(feedback.id, { channel: pick(CHANNELS, i), answers });
      }
    }
  }
}
