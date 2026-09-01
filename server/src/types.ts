// Shared domain types for the Surket platform (events + itinerary + surveys + live tally).
// Intentionally runtime-agnostic so the SAME Store contract is satisfied by the
// Node driver (node:sqlite) and the Cloudflare driver (D1).

export type EventStatus = "draft" | "live" | "archived";
export type SurveyStatus = "draft" | "live" | "paused" | "closed";
export type SurveyMode = "standard" | "live";
export type QuestionType =
  | "rating"
  | "single"
  | "multi"
  | "number"
  | "text"
  | "nps"
  | "scale"
  | "date";
export type SegmentKind =
  | "keynote"
  | "session"
  | "workshop"
  | "panel"
  | "break"
  | "networking"
  | "survey";

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

// Per-question extensible configuration (scale bounds, nps labels, etc).
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

export interface SurveyWithQuestions extends Survey {
  questions: Question[];
}

export type AnswerValue = string | number | string[];

export interface AnswerInput {
  questionId: string;
  value: AnswerValue;
}

export interface ResponseRecord {
  id: string;
  surveyId: string;
  createdAt: string;
  channel: string;
  note: string;
}

export interface ResponseWithAnswers extends ResponseRecord {
  answers: Record<string, AnswerValue>;
}

export interface AnswerRow {
  questionId: string;
  value: AnswerValue;
  createdAt: string;
}

// --- Aggregated analytics / live tally shapes ---

export interface QuestionTally {
  questionId: string;
  label: string;
  type: QuestionType;
  total: number;
  buckets: { label: string; value: number }[];
  average: number | null;
  npsScore: number | null; // -100..100 for nps questions
}

export interface Keyword {
  word: string;
  count: number;
}

export interface SurveyResults {
  surveyId: string;
  totalResponses: number;
  completionRate: number; // 0..1
  averageRating: number | null;
  npsScore: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  questions: QuestionTally[];
  channels: { label: string; value: number }[];
  daily: { label: string; value: number }[];
  keywords: Keyword[];
  version: number; // increments on every recorded response (live-tally cursor)
}

// --- Store contract (implemented by sqliteStore + d1Store) ---

export interface CreateEventInput {
  title: string;
  description?: string;
  organizer?: string;
  location?: string;
  startsAt?: string | null;
  theme?: string;
  status?: EventStatus;
  slug?: string;
}

export interface CreateSegmentInput {
  title: string;
  kind?: SegmentKind;
  speaker?: string;
  location?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  description?: string;
  surveyId?: string | null;
  position?: number;
}

export interface CreateSurveyInput {
  title: string;
  eventId?: string | null;
  description?: string;
  audience?: string;
  status?: SurveyStatus;
  mode?: SurveyMode;
}

export interface CreateQuestionInput {
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  config?: QuestionConfig;
  position?: number;
}

export interface CreateResponseInput {
  channel?: string;
  note?: string;
  answers: AnswerInput[];
}

export interface Store {
  init(): Promise<void>;

  listEvents(): Promise<EventRecord[]>;
  getEvent(id: string): Promise<EventRecord | null>;
  getEventBySlug(slug: string): Promise<EventRecord | null>;
  createEvent(input: CreateEventInput): Promise<EventRecord>;
  updateEvent(id: string, patch: Partial<CreateEventInput>): Promise<EventRecord | null>;
  deleteEvent(id: string): Promise<boolean>;

  listSegments(eventId: string): Promise<Segment[]>;
  createSegment(eventId: string, input: CreateSegmentInput): Promise<Segment | null>;
  updateSegment(id: string, patch: Partial<CreateSegmentInput>): Promise<Segment | null>;
  deleteSegment(id: string): Promise<boolean>;
  reorderSegments(eventId: string, orderedIds: string[]): Promise<void>;

  listSurveys(eventId?: string | null): Promise<Survey[]>;
  getSurvey(id: string): Promise<SurveyWithQuestions | null>;
  getSurveyByJoinCode(code: string): Promise<SurveyWithQuestions | null>;
  createSurvey(input: CreateSurveyInput): Promise<Survey>;
  updateSurvey(
    id: string,
    patch: Partial<CreateSurveyInput> & { isLive?: boolean }
  ): Promise<Survey | null>;
  deleteSurvey(id: string): Promise<boolean>;
  duplicateSurvey(id: string): Promise<SurveyWithQuestions | null>;

  createQuestion(surveyId: string, input: CreateQuestionInput): Promise<Question | null>;
  updateQuestion(id: string, patch: Partial<CreateQuestionInput>): Promise<Question | null>;
  deleteQuestion(id: string): Promise<boolean>;
  reorderQuestions(surveyId: string, orderedIds: string[]): Promise<void>;

  createResponse(surveyId: string, input: CreateResponseInput): Promise<ResponseWithAnswers | null>;
  listResponses(surveyId: string, limit?: number): Promise<ResponseWithAnswers[]>;
  countResponses(surveyId: string): Promise<number>;
  getAnswerRows(surveyId: string): Promise<AnswerRow[]>;
  getResponseMeta(surveyId: string): Promise<{ createdAt: string; channel: string }[]>;
}
