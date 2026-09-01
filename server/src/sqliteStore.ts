// SQLite-backed Store implementation.
//
// It depends only on a tiny driver interface (`SqliteDriver`) that BOTH
// Node's built-in `node:sqlite` (used by the Node + Vercel entries) satisfies with
// positional `?` parameters. That keeps the data logic identical between the
// shipped runtime and the in-sandbox verification harness.

import { SCHEMA_SQL } from "./schema.js";
import {
  bool,
  clampNumber,
  id,
  joinCode,
  nowIso,
  safeJsonParse,
  slugify,
  str,
} from "./util.js";
import type {
  AnswerRow,
  CreateEventInput,
  CreateQuestionInput,
  CreateResponseInput,
  CreateSegmentInput,
  CreateSurveyInput,
  EventRecord,
  Question,
  QuestionConfig,
  ResponseWithAnswers,
  Segment,
  Store,
  Survey,
  SurveyWithQuestions,
} from "./types.js";

export interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}
export interface SqliteDriver {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

function mapEvent(r: any): EventRecord {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description || "",
    organizer: r.organizer || "",
    location: r.location || "",
    startsAt: r.starts_at ?? null,
    theme: r.theme || "aurora",
    status: r.status || "draft",
    createdAt: r.created_at,
  };
}

function mapSegment(r: any): Segment {
  return {
    id: r.id,
    eventId: r.event_id,
    position: clampNumber(r.position),
    title: r.title,
    kind: r.kind || "session",
    speaker: r.speaker || "",
    location: r.location || "",
    startsAt: r.starts_at ?? null,
    endsAt: r.ends_at ?? null,
    description: r.description || "",
    surveyId: r.survey_id ?? null,
  };
}

function mapSurvey(r: any): Survey {
  return {
    id: r.id,
    eventId: r.event_id ?? null,
    title: r.title,
    description: r.description || "",
    audience: r.audience || "",
    status: r.status || "draft",
    mode: r.mode || "standard",
    isLive: bool(r.is_live),
    joinCode: r.join_code,
    createdAt: r.created_at,
  };
}

function mapQuestion(r: any): Question {
  return {
    id: r.id,
    surveyId: r.survey_id,
    position: clampNumber(r.position),
    label: r.label,
    type: r.type,
    required: bool(r.required),
    options: safeJsonParse<string[]>(r.options, []),
    config: safeJsonParse<QuestionConfig>(r.config, {}),
  };
}

export function createSqliteStore(db: SqliteDriver): Store {
  async function uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base);
    let n = 1;
    while (db.prepare("SELECT 1 FROM events WHERE slug = ?").get(slug)) {
      n += 1;
      slug = `${slugify(base)}-${n}`;
    }
    return slug;
  }

  function uniqueJoinCode(): string {
    let code = joinCode();
    while (db.prepare("SELECT 1 FROM surveys WHERE join_code = ?").get(code)) {
      code = joinCode();
    }
    return code;
  }

  function loadSurvey(surveyId: string): SurveyWithQuestions | null {
    const row = db.prepare("SELECT * FROM surveys WHERE id = ?").get(surveyId);
    if (!row) return null;
    const questions = db
      .prepare("SELECT * FROM questions WHERE survey_id = ? ORDER BY position ASC")
      .all(surveyId)
      .map(mapQuestion);
    return { ...mapSurvey(row), questions };
  }

  return {
    async init() {
      db.exec(SCHEMA_SQL);
    },

    // ---- events ----
    async listEvents() {
      return db.prepare("SELECT * FROM events ORDER BY created_at DESC").all().map(mapEvent);
    },
    async getEvent(eventId) {
      const row = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
      return row ? mapEvent(row) : null;
    },
    async getEventBySlug(slug) {
      const row = db.prepare("SELECT * FROM events WHERE slug = ?").get(slug);
      return row ? mapEvent(row) : null;
    },
    async createEvent(input: CreateEventInput) {
      const eventId = id("evt");
      const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(input.title);
      const rec: EventRecord = {
        id: eventId,
        slug,
        title: str(input.title, 160) || "Untitled event",
        description: str(input.description || ""),
        organizer: str(input.organizer || "", 160),
        location: str(input.location || "", 160),
        startsAt: input.startsAt ?? null,
        theme: str(input.theme || "aurora", 32),
        status: input.status || "draft",
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO events (id, slug, title, description, organizer, location, starts_at, theme, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        rec.id, rec.slug, rec.title, rec.description, rec.organizer,
        rec.location, rec.startsAt, rec.theme, rec.status, rec.createdAt
      );
      return rec;
    },
    async updateEvent(eventId, patch) {
      const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
      if (!existing) return null;
      const merged = mapEvent(existing);
      const next = {
        title: patch.title !== undefined ? str(patch.title, 160) : merged.title,
        description: patch.description !== undefined ? str(patch.description) : merged.description,
        organizer: patch.organizer !== undefined ? str(patch.organizer, 160) : merged.organizer,
        location: patch.location !== undefined ? str(patch.location, 160) : merged.location,
        startsAt: patch.startsAt !== undefined ? patch.startsAt : merged.startsAt,
        theme: patch.theme !== undefined ? str(patch.theme, 32) : merged.theme,
        status: patch.status !== undefined ? patch.status : merged.status,
      };
      db.prepare(
        `UPDATE events SET title=?, description=?, organizer=?, location=?, starts_at=?, theme=?, status=? WHERE id=?`
      ).run(next.title, next.description, next.organizer, next.location, next.startsAt, next.theme, next.status, eventId);
      return { ...merged, ...next };
    },
    async deleteEvent(eventId) {
      const r: any = db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
      return (r.changes ?? 0) > 0;
    },

    // ---- segments (itinerary) ----
    async listSegments(eventId) {
      return db
        .prepare("SELECT * FROM segments WHERE event_id = ? ORDER BY position ASC, starts_at ASC")
        .all(eventId)
        .map(mapSegment);
    },
    async createSegment(eventId, input: CreateSegmentInput) {
      const event = db.prepare("SELECT 1 FROM events WHERE id = ?").get(eventId);
      if (!event) return null;
      const posRow: any = db
        .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM segments WHERE event_id = ?")
        .get(eventId);
      const seg: Segment = {
        id: id("seg"),
        eventId,
        position: input.position ?? clampNumber(posRow?.pos),
        title: str(input.title, 160) || "Untitled segment",
        kind: input.kind || "session",
        speaker: str(input.speaker || "", 160),
        location: str(input.location || "", 160),
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        description: str(input.description || ""),
        surveyId: input.surveyId ?? null,
      };
      db.prepare(
        `INSERT INTO segments (id, event_id, position, title, kind, speaker, location, starts_at, ends_at, description, survey_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        seg.id, seg.eventId, seg.position, seg.title, seg.kind, seg.speaker,
        seg.location, seg.startsAt, seg.endsAt, seg.description, seg.surveyId
      );
      return seg;
    },
    async updateSegment(segmentId, patch) {
      const existing = db.prepare("SELECT * FROM segments WHERE id = ?").get(segmentId);
      if (!existing) return null;
      const merged = mapSegment(existing);
      const next = {
        title: patch.title !== undefined ? str(patch.title, 160) : merged.title,
        kind: patch.kind !== undefined ? patch.kind : merged.kind,
        speaker: patch.speaker !== undefined ? str(patch.speaker, 160) : merged.speaker,
        location: patch.location !== undefined ? str(patch.location, 160) : merged.location,
        startsAt: patch.startsAt !== undefined ? patch.startsAt : merged.startsAt,
        endsAt: patch.endsAt !== undefined ? patch.endsAt : merged.endsAt,
        description: patch.description !== undefined ? str(patch.description) : merged.description,
        surveyId: patch.surveyId !== undefined ? patch.surveyId : merged.surveyId,
        position: patch.position !== undefined ? clampNumber(patch.position) : merged.position,
      };
      db.prepare(
        `UPDATE segments SET title=?, kind=?, speaker=?, location=?, starts_at=?, ends_at=?, description=?, survey_id=?, position=? WHERE id=?`
      ).run(next.title, next.kind, next.speaker, next.location, next.startsAt, next.endsAt, next.description, next.surveyId, next.position, segmentId);
      return { ...merged, ...next };
    },
    async deleteSegment(segmentId) {
      const r: any = db.prepare("DELETE FROM segments WHERE id = ?").run(segmentId);
      return (r.changes ?? 0) > 0;
    },
    async reorderSegments(eventId, orderedIds) {
      const stmt = db.prepare("UPDATE segments SET position = ? WHERE id = ? AND event_id = ?");
      orderedIds.forEach((sid, index) => stmt.run(index, sid, eventId));
    },

    // ---- surveys ----
    async listSurveys(eventId) {
      if (eventId === undefined || eventId === null) {
        return db.prepare("SELECT * FROM surveys ORDER BY created_at DESC").all().map(mapSurvey);
      }
      return db
        .prepare("SELECT * FROM surveys WHERE event_id = ? ORDER BY created_at DESC")
        .all(eventId)
        .map(mapSurvey);
    },
    async getSurvey(surveyId) {
      return loadSurvey(surveyId);
    },
    async getSurveyByJoinCode(code) {
      const row = db.prepare("SELECT id FROM surveys WHERE join_code = ?").get(String(code).toUpperCase());
      return row ? loadSurvey(row.id) : null;
    },
    async createSurvey(input: CreateSurveyInput) {
      const survey: Survey = {
        id: id("svy"),
        eventId: input.eventId ?? null,
        title: str(input.title, 160) || "Untitled survey",
        description: str(input.description || ""),
        audience: str(input.audience || "", 160),
        status: input.status || "draft",
        mode: input.mode || "standard",
        isLive: false,
        joinCode: uniqueJoinCode(),
        createdAt: nowIso(),
      };
      db.prepare(
        `INSERT INTO surveys (id, event_id, title, description, audience, status, mode, is_live, join_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        survey.id, survey.eventId, survey.title, survey.description, survey.audience,
        survey.status, survey.mode, survey.isLive ? 1 : 0, survey.joinCode, survey.createdAt
      );
      return survey;
    },
    async updateSurvey(surveyId, patch) {
      const existing = db.prepare("SELECT * FROM surveys WHERE id = ?").get(surveyId);
      if (!existing) return null;
      const merged = mapSurvey(existing);
      const next = {
        title: patch.title !== undefined ? str(patch.title, 160) : merged.title,
        description: patch.description !== undefined ? str(patch.description) : merged.description,
        audience: patch.audience !== undefined ? str(patch.audience, 160) : merged.audience,
        status: patch.status !== undefined ? patch.status : merged.status,
        mode: patch.mode !== undefined ? patch.mode : merged.mode,
        eventId: patch.eventId !== undefined ? patch.eventId : merged.eventId,
        isLive: patch.isLive !== undefined ? patch.isLive : merged.isLive,
      };
      db.prepare(
        `UPDATE surveys SET title=?, description=?, audience=?, status=?, mode=?, event_id=?, is_live=? WHERE id=?`
      ).run(next.title, next.description, next.audience, next.status, next.mode, next.eventId, next.isLive ? 1 : 0, surveyId);
      return { ...merged, ...next };
    },
    async deleteSurvey(surveyId) {
      const r: any = db.prepare("DELETE FROM surveys WHERE id = ?").run(surveyId);
      return (r.changes ?? 0) > 0;
    },
    async duplicateSurvey(surveyId) {
      const source = loadSurvey(surveyId);
      if (!source) return null;
      const clone = await this.createSurvey({
        title: `${source.title} (copy)`,
        eventId: source.eventId,
        description: source.description,
        audience: source.audience,
        status: "draft",
        mode: source.mode,
      });
      for (const q of source.questions) {
        await this.createQuestion(clone.id, {
          label: q.label,
          type: q.type,
          required: q.required,
          options: q.options,
          config: q.config,
          position: q.position,
        });
      }
      return loadSurvey(clone.id);
    },

    // ---- questions ----
    async createQuestion(surveyId, input: CreateQuestionInput) {
      const survey = db.prepare("SELECT 1 FROM surveys WHERE id = ?").get(surveyId);
      if (!survey) return null;
      const posRow: any = db
        .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM questions WHERE survey_id = ?")
        .get(surveyId);
      const question: Question = {
        id: id("qn"),
        surveyId,
        position: input.position ?? clampNumber(posRow?.pos),
        label: str(input.label, 400) || "Untitled question",
        type: input.type,
        required: input.required ?? false,
        options: Array.isArray(input.options) ? input.options.map((o) => str(o, 160)) : [],
        config: input.config || {},
      };
      db.prepare(
        `INSERT INTO questions (id, survey_id, position, label, type, required, options, config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        question.id, question.surveyId, question.position, question.label, question.type,
        question.required ? 1 : 0, JSON.stringify(question.options), JSON.stringify(question.config)
      );
      return question;
    },
    async updateQuestion(questionId, patch) {
      const existing = db.prepare("SELECT * FROM questions WHERE id = ?").get(questionId);
      if (!existing) return null;
      const merged = mapQuestion(existing);
      const next = {
        label: patch.label !== undefined ? str(patch.label, 400) : merged.label,
        type: patch.type !== undefined ? patch.type : merged.type,
        required: patch.required !== undefined ? patch.required : merged.required,
        options: patch.options !== undefined ? patch.options.map((o) => str(o, 160)) : merged.options,
        config: patch.config !== undefined ? patch.config : merged.config,
        position: patch.position !== undefined ? clampNumber(patch.position) : merged.position,
      };
      db.prepare(
        `UPDATE questions SET label=?, type=?, required=?, options=?, config=?, position=? WHERE id=?`
      ).run(next.label, next.type, next.required ? 1 : 0, JSON.stringify(next.options), JSON.stringify(next.config), next.position, questionId);
      return { ...merged, ...next };
    },
    async deleteQuestion(questionId) {
      const r: any = db.prepare("DELETE FROM questions WHERE id = ?").run(questionId);
      return (r.changes ?? 0) > 0;
    },
    async reorderQuestions(surveyId, orderedIds) {
      const stmt = db.prepare("UPDATE questions SET position = ? WHERE id = ? AND survey_id = ?");
      orderedIds.forEach((qid, index) => stmt.run(index, qid, surveyId));
    },

    // ---- responses ----
    async createResponse(surveyId, input: CreateResponseInput) {
      const survey = loadSurvey(surveyId);
      if (!survey) return null;
      const responseId = id("rsp");
      const createdAt = nowIso();
      const channel = str(input.channel || "web", 40);
      const note = str(input.note || "", 500);
      db.prepare(
        "INSERT INTO responses (id, survey_id, created_at, channel, note) VALUES (?, ?, ?, ?, ?)"
      ).run(responseId, surveyId, createdAt, channel, note);

      const valid = new Map(survey.questions.map((q) => [q.id, q]));
      const answers: Record<string, any> = {};
      const insert = db.prepare(
        "INSERT INTO answers (id, response_id, question_id, value) VALUES (?, ?, ?, ?)"
      );
      for (const ans of input.answers || []) {
        if (!valid.has(ans.questionId)) continue;
        const encoded = JSON.stringify(ans.value);
        insert.run(id("ans"), responseId, ans.questionId, encoded);
        answers[ans.questionId] = ans.value;
      }
      return { id: responseId, surveyId, createdAt, channel, note, answers };
    },
    async listResponses(surveyId, limit = 50) {
      const rows = db
        .prepare("SELECT * FROM responses WHERE survey_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(surveyId, limit);
      const result: ResponseWithAnswers[] = [];
      const aStmt = db.prepare("SELECT question_id, value FROM answers WHERE response_id = ?");
      for (const row of rows) {
        const answers: Record<string, any> = {};
        for (const a of aStmt.all(row.id)) {
          answers[a.question_id] = safeJsonParse(a.value, a.value);
        }
        result.push({
          id: row.id,
          surveyId: row.survey_id,
          createdAt: row.created_at,
          channel: row.channel,
          note: row.note,
          answers,
        });
      }
      return result;
    },
    async countResponses(surveyId) {
      const row: any = db.prepare("SELECT COUNT(*) AS c FROM responses WHERE survey_id = ?").get(surveyId);
      return clampNumber(row?.c);
    },
    async getAnswerRows(surveyId) {
      const rows = db
        .prepare(
          `SELECT a.question_id, a.value, r.created_at
           FROM answers a JOIN responses r ON r.id = a.response_id
           WHERE r.survey_id = ?`
        )
        .all(surveyId);
      return rows.map((r: any): AnswerRow => ({
        questionId: r.question_id,
        value: safeJsonParse(r.value, r.value),
        createdAt: r.created_at,
      }));
    },
    async getResponseMeta(surveyId) {
      const rows = db
        .prepare("SELECT created_at, channel FROM responses WHERE survey_id = ? ORDER BY created_at ASC")
        .all(surveyId);
      return rows.map((r: any) => ({ createdAt: r.created_at, channel: r.channel || "web" }));
    },
  };
}
