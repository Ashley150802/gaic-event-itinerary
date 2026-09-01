// Template library. Templates are plain data, so developers building on top of
// Surket can add their own by appending to these arrays -- no engine changes.
//
// Two template families:
//   * surveyTemplates  -> instantiate a single survey (+ questions)
//   * eventTemplates   -> instantiate a full event (itinerary segments + surveys)

import type {
  CreateQuestionInput,
  CreateSegmentInput,
  EventStatus,
  Store,
  SurveyMode,
} from "./types.js";

export interface SurveyTemplate {
  id: string;
  name: string;
  category: "feedback" | "research" | "live" | "pulse";
  description: string;
  icon: string;
  mode: SurveyMode;
  audience: string;
  questions: CreateQuestionInput[];
}

export interface EventTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  theme: string;
  status: EventStatus;
  segments: CreateSegmentInput[];
  /** survey template ids to attach to the event */
  surveys: string[];
}

export const surveyTemplates: SurveyTemplate[] = [
  {
    id: "live-pulse",
    name: "Live Audience Pulse",
    category: "live",
    description: "A fast, single-question live poll designed to be tallied on a big screen in real time.",
    icon: "\u26A1",
    mode: "live",
    audience: "Live audience",
    questions: [
      {
        label: "How are you feeling about today so far?",
        type: "single",
        required: true,
        options: ["Energised", "Curious", "Neutral", "Lost"],
      },
    ],
  },
  {
    id: "event-feedback",
    name: "Event Feedback (CSAT)",
    category: "feedback",
    description: "Post-event satisfaction survey with rating, NPS, and open feedback.",
    icon: "\u2B50",
    mode: "standard",
    audience: "Event attendees",
    questions: [
      { label: "How would you rate the event overall?", type: "rating", required: true, config: { min: 1, max: 5 } },
      { label: "How likely are you to recommend this event to a colleague?", type: "nps", required: true },
      {
        label: "Which session was most valuable?",
        type: "single",
        required: false,
        options: ["Keynote", "Workshop", "Panel", "Networking"],
      },
      { label: "What should we improve next time?", type: "text", required: false },
    ],
  },
  {
    id: "nps-pulse",
    name: "NPS Pulse",
    category: "pulse",
    description: "The classic Net Promoter Score question plus a single reason field.",
    icon: "\uD83D\uDCC8",
    mode: "standard",
    audience: "Customers",
    questions: [
      { label: "How likely are you to recommend us to a friend or colleague?", type: "nps", required: true },
      { label: "What is the main reason for your score?", type: "text", required: false },
    ],
  },
  {
    id: "product-concept",
    name: "Product Concept Scan",
    category: "research",
    description: "Test product-market fit signals, feature priorities, and objections.",
    icon: "\uD83E\uDDEA",
    mode: "standard",
    audience: "Target users & buyers",
    questions: [
      { label: "How strong is the fit for your workflow?", type: "rating", required: true, config: { min: 1, max: 5 } },
      {
        label: "Which capability matters most?",
        type: "multi",
        required: true,
        options: ["Automation", "Reporting", "Integrations", "Security", "Price"],
      },
      { label: "What would you expect to pay per month?", type: "number", required: false },
      { label: "What is the strongest objection you would raise?", type: "text", required: false },
    ],
  },
  {
    id: "workshop-feedback",
    name: "Workshop Feedback",
    category: "feedback",
    description: "Measure clarity, pace, and confidence after a hands-on session.",
    icon: "\uD83D\uDEE0\uFE0F",
    mode: "standard",
    audience: "Workshop participants",
    questions: [
      { label: "How clear was the material?", type: "rating", required: true, config: { min: 1, max: 5 } },
      { label: "Was the pace right for you?", type: "single", required: true, options: ["Too slow", "Just right", "Too fast"] },
      { label: "How confident do you feel applying this now? (0-10)", type: "scale", required: true, config: { min: 0, max: 10, minLabel: "Not at all", maxLabel: "Very confident" } },
      { label: "What is one thing you want to learn next?", type: "text", required: false },
    ],
  },
];

export const eventTemplates: EventTemplate[] = [
  {
    id: "ai-meetup",
    name: "AI Meetup (Half-day)",
    description: "A founder/developer AI meetup with a keynote, demos, a live poll, and closing feedback.",
    icon: "\uD83E\uDD16",
    theme: "aurora",
    status: "draft",
    segments: [
      { title: "Doors open & coffee", kind: "networking", startsAt: "09:00", endsAt: "09:30", location: "Atrium" },
      { title: "Welcome & house rules", kind: "keynote", startsAt: "09:30", endsAt: "09:45", speaker: "Host" },
      { title: "Keynote: Building agentic products", kind: "keynote", startsAt: "09:45", endsAt: "10:30", speaker: "Guest speaker" },
      { title: "Live audience pulse", kind: "survey", startsAt: "10:30", endsAt: "10:40", description: "Tally the room live." },
      { title: "Lightning demos", kind: "session", startsAt: "10:40", endsAt: "11:30" },
      { title: "Break", kind: "break", startsAt: "11:30", endsAt: "11:45" },
      { title: "Panel: From prototype to production", kind: "panel", startsAt: "11:45", endsAt: "12:30" },
      { title: "Closing feedback & networking", kind: "networking", startsAt: "12:30", endsAt: "13:00" },
    ],
    surveys: ["live-pulse", "event-feedback"],
  },
  {
    id: "conference",
    name: "Full-day Conference",
    description: "Multi-track conference scaffold with keynotes, breakouts, and an NPS close.",
    icon: "\uD83C\uDFA4",
    theme: "ember",
    status: "draft",
    segments: [
      { title: "Registration", kind: "networking", startsAt: "08:30", endsAt: "09:00" },
      { title: "Opening keynote", kind: "keynote", startsAt: "09:00", endsAt: "10:00" },
      { title: "Breakout sessions (Track A/B)", kind: "session", startsAt: "10:15", endsAt: "11:15" },
      { title: "Live poll: pick the afternoon deep-dive", kind: "survey", startsAt: "11:15", endsAt: "11:25" },
      { title: "Lunch", kind: "break", startsAt: "12:00", endsAt: "13:00" },
      { title: "Workshops", kind: "workshop", startsAt: "13:00", endsAt: "15:00" },
      { title: "Closing panel", kind: "panel", startsAt: "15:30", endsAt: "16:30" },
      { title: "Wrap-up & feedback", kind: "survey", startsAt: "16:30", endsAt: "17:00" },
    ],
    surveys: ["live-pulse", "event-feedback", "nps-pulse"],
  },
  {
    id: "workshop",
    name: "Hands-on Workshop",
    description: "A single-track teaching workshop with confidence checks and feedback.",
    icon: "\uD83D\uDEE0\uFE0F",
    theme: "forest",
    status: "draft",
    segments: [
      { title: "Setup & environment check", kind: "session", startsAt: "10:00", endsAt: "10:20" },
      { title: "Concept walkthrough", kind: "session", startsAt: "10:20", endsAt: "11:00" },
      { title: "Guided build", kind: "workshop", startsAt: "11:00", endsAt: "12:00" },
      { title: "Mid-point confidence check", kind: "survey", startsAt: "12:00", endsAt: "12:10" },
      { title: "Independent exercise", kind: "workshop", startsAt: "12:10", endsAt: "13:00" },
      { title: "Q&A and feedback", kind: "survey", startsAt: "13:00", endsAt: "13:30" },
    ],
    surveys: ["workshop-feedback", "live-pulse"],
  },
];

export function listTemplates() {
  return {
    surveys: surveyTemplates.map(({ questions, ...meta }) => ({ ...meta, questionCount: questions.length })),
    events: eventTemplates.map(({ segments, surveys, ...meta }) => ({
      ...meta,
      segmentCount: segments.length,
      surveyCount: surveys.length,
    })),
  };
}

export async function applySurveyTemplate(
  store: Store,
  templateId: string,
  eventId: string | null = null
) {
  const tpl = surveyTemplates.find((t) => t.id === templateId);
  if (!tpl) return null;
  const survey = await store.createSurvey({
    title: tpl.name,
    description: tpl.description,
    audience: tpl.audience,
    mode: tpl.mode,
    eventId,
    status: "draft",
  });
  for (const q of tpl.questions) {
    await store.createQuestion(survey.id, q);
  }
  return store.getSurvey(survey.id);
}

export async function applyEventTemplate(store: Store, templateId: string) {
  const tpl = eventTemplates.find((t) => t.id === templateId);
  if (!tpl) return null;
  const event = await store.createEvent({
    title: tpl.name,
    description: tpl.description,
    theme: tpl.theme,
    status: tpl.status,
  });

  // create surveys first so survey-kind segments can be linked
  const surveyByTpl = new Map<string, string>();
  for (const sid of tpl.surveys) {
    const created = await applySurveyTemplate(store, sid, event.id);
    if (created) surveyByTpl.set(sid, created.id);
  }
  const firstSurveyId = surveyByTpl.values().next().value ?? null;

  for (const seg of tpl.segments) {
    await store.createSegment(event.id, {
      ...seg,
      surveyId: seg.kind === "survey" ? firstSurveyId : null,
    });
  }
  return store.getEvent(event.id);
}
