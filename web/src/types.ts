// Front-end mirror of the server domain types. Kept in sync manually; the API
// contract is documented in ARCHITECTURE.md so this stays stable for developers
// building on top of Surket.

export type EventStatus = "draft" | "live" | "archived";
export type SurveyStatus = "draft" | "live" | "paused" | "closed";
export type SurveyMode = "standard" | "live";
export type QuestionType =
  | "rating" | "single" | "multi" | "number" | "text" | "nps" | "scale" | "date";
export type SegmentKind =
  | "keynote" | "session" | "workshop" | "panel" | "break" | "networking" | "survey";

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  organizer: string;
  location: string;
  startsAt: string | null;
  theme: string;
  status: EventStatus;
  createdAt: string;
}

export interface Segment {
  id: string;
  eventId: string;
  position: number;
  title: string;
  kind: SegmentKind;
  speaker: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  description: string;
  surveyId: string | null;
}

export interface QuestionConfig {
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  step?: number;
}

export interface Question {
  id: string;
  surveyId: string;
  position: number;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  config: QuestionConfig;
}

export interface Survey {
  id: string;
  eventId: string | null;
  title: string;
  description: string;
  audience: string;
  status: SurveyStatus;
  mode: SurveyMode;
  isLive: boolean;
  joinCode: string;
  createdAt: string;
}

export interface SurveyWithQuestions extends Survey {
  questions: Question[];
}

export interface QuestionTally {
  questionId: string;
  label: string;
  type: QuestionType;
  total: number;
  buckets: { label: string; value: number }[];
  average: number | null;
  npsScore: number | null;
}

export interface SurveyResults {
  surveyId: string;
  totalResponses: number;
  completionRate: number;
  averageRating: number | null;
  npsScore: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  questions: QuestionTally[];
  channels: { label: string; value: number }[];
  daily: { label: string; value: number }[];
  keywords: { word: string; count: number }[];
  version: number;
}

export interface ResponseWithAnswers {
  id: string;
  surveyId: string;
  createdAt: string;
  channel: string;
  note: string;
  respondentName: string;
  answers: Record<string, string | number | string[]>;
}

export interface EventDetail {
  event: EventRecord;
  segments: Segment[];
  surveys: Survey[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  category?: string;
  theme?: string;
  questionCount?: number;
  segmentCount?: number;
  surveyCount?: number;
}

export interface TemplateCatalog {
  surveys: TemplateSummary[];
  events: TemplateSummary[];
}
