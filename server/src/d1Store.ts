// Cloudflare D1 implementation of the Store contract.
//
// D1 is async and uses `.bind(...).run()/.all()/.first()`, so it cannot reuse
// the synchronous driver shape from sqliteStore.ts. The SQL and row mapping are
// identical though -- this is a thin async mirror over the same schema.

import { SCHEMA_SQL } from "./schema.js";
import { bool, clampNumber, id, joinCode, nowIso, safeJsonParse, slugify, str } from "./util.js";
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

// Minimal structural type for the D1 binding (avoids a hard dep on workers types).
export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      all(): Promise<{ results: any[] }>;
      first(): Promise<any>;
    };
  };
  exec(sql: string): Promise<unknown>;
  batch(stmts: unknown[]): Promise<unknown>;
}

const mapEvent = (r: any): EventRecord => ({
  id: r.id, slug: r.slug, title: r.title, description: r.description || "",
  organizer: r.organizer || "", location: r.location || "", startsAt: r.starts_at ?? null,
  theme: r.theme || "aurora", status: r.status || "draft", createdAt: r.created_at,
});
const mapSegment = (r: any): Segment => ({
  id: r.id, eventId: r.event_id, position: clampNumber(r.position), title: r.title,
  kind: r.kind || "session", speaker: r.speaker || "", location: r.location || "",
  startsAt: r.starts_at ?? null, endsAt: r.ends_at ?? null, description: r.description || "",
  surveyId: r.survey_id ?? null,
});
const mapSurvey = (r: any): Survey => ({
  id: r.id, eventId: r.event_id ?? null, title: r.title, description: r.description || "",
  audience: r.audience || "", status: r.status || "draft", mode: r.mode || "standard",
  isLive: bool(r.is_live), joinCode: r.join_code, createdAt: r.created_at,
});
const mapQuestion = (r: any): Question => ({
  id: r.id, surveyId: r.survey_id, position: clampNumber(r.position), label: r.label,
  type: r.type, required: bool(r.required), options: safeJsonParse<string[]>(r.options, []),
  config: safeJsonParse<QuestionConfig>(r.config, {}),
});

export function createD1Store(db: D1Like): Store {
  const all = async (sql: string, ...p: unknown[]) => (await db.prepare(sql).bind(...p).all()).results || [];
  const first = async (sql: string, ...p: unknown[]) => db.prepare(sql).bind(...p).first();
  const run = async (sql: string, ...p: unknown[]) => db.prepare(sql).bind(...p).run();

  async function uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base);
    let n = 1;
    while (await first("SELECT 1 FROM events WHERE slug = ?", slug)) {
      n += 1; slug = `${slugify(base)}-${n}`;
    }
    return slug;
  }
  async function uniqueJoinCode(): Promise<string> {
    let code = joinCode();
    while (await first("SELECT 1 FROM surveys WHERE join_code = ?", code)) code = joinCode();
    return code;
  }
  async function loadSurvey(surveyId: string): Promise<SurveyWithQuestions | null> {
    const row = await first("SELECT * FROM surveys WHERE id = ?", surveyId);
    if (!row) return null;
    const qs = await all("SELECT * FROM questions WHERE survey_id = ? ORDER BY position ASC", surveyId);
    return { ...mapSurvey(row), questions: qs.map(mapQuestion) };
  }

  const store: Store = {
    async init() {
      // D1 exec() can run multiple statements. However, PRAGMA foreign_keys
      // may error on some D1 versions, so we run it separately and swallow
      // errors. The CREATE TABLE IF NOT EXISTS statements are idempotent.
      try { await db.exec("PRAGMA foreign_keys = ON;"); } catch { /* D1 default is ON */ }
      const ddl = SCHEMA_SQL
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("PRAGMA"));
      // Use batch() with prepared statements — exec() can truncate multi-line
      // DDL on some D1 runtimes, causing "incomplete input: SQLITE_ERROR".
      try {
        await db.batch(ddl.map((s) => db.prepare(s + ";")));
      } catch (e: any) {
        // Fallback: run each statement individually.
        for (const stmt of ddl) {
          try { await db.prepare(stmt + ";").bind().run(); } catch (inner: any) {
            if (!/already exists/i.test(String(inner?.message || inner))) throw inner;
          }
        }
      }
      try {
        await run("ALTER TABLE responses ADD COLUMN respondent_name TEXT NOT NULL DEFAULT ''");
      } catch (e) {
        if (!/duplicate column name/i.test(String(e))) throw e;
      }
    },
    async listEvents() { return (await all("SELECT * FROM events ORDER BY created_at DESC")).map(mapEvent); },
    async getEvent(eventId) { const r = await first("SELECT * FROM events WHERE id = ?", eventId); return r ? mapEvent(r) : null; },
    async getEventBySlug(slug) { const r = await first("SELECT * FROM events WHERE slug = ?", slug); return r ? mapEvent(r) : null; },
    async createEvent(input: CreateEventInput) {
      const rec: EventRecord = {
        id: id("evt"), slug: await uniqueSlug(input.slug || input.title),
        title: str(input.title, 160) || "Untitled event", description: str(input.description || ""),
        organizer: str(input.organizer || "", 160), location: str(input.location || "", 160),
        startsAt: input.startsAt ?? null, theme: str(input.theme || "aurora", 32),
        status: input.status || "draft", createdAt: nowIso(),
      };
      await run(
        `INSERT INTO events (id, slug, title, description, organizer, location, starts_at, theme, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        rec.id, rec.slug, rec.title, rec.description, rec.organizer, rec.location, rec.startsAt, rec.theme, rec.status, rec.createdAt
      );
      return rec;
    },
    async updateEvent(eventId, patch) {
      const existing = await first("SELECT * FROM events WHERE id = ?", eventId);
      if (!existing) return null;
      const m = mapEvent(existing);
      const n = {
        title: patch.title !== undefined ? str(patch.title, 160) : m.title,
        description: patch.description !== undefined ? str(patch.description) : m.description,
        organizer: patch.organizer !== undefined ? str(patch.organizer, 160) : m.organizer,
        location: patch.location !== undefined ? str(patch.location, 160) : m.location,
        startsAt: patch.startsAt !== undefined ? patch.startsAt : m.startsAt,
        theme: patch.theme !== undefined ? str(patch.theme, 32) : m.theme,
        status: patch.status !== undefined ? patch.status : m.status,
      };
      await run(`UPDATE events SET title=?, description=?, organizer=?, location=?, starts_at=?, theme=?, status=? WHERE id=?`,
        n.title, n.description, n.organizer, n.location, n.startsAt, n.theme, n.status, eventId);
      return { ...m, ...n };
    },
    async deleteEvent(eventId) { await run("DELETE FROM events WHERE id = ?", eventId); return true; },

    async listSegments(eventId) { return (await all("SELECT * FROM segments WHERE event_id = ? ORDER BY position ASC, starts_at ASC", eventId)).map(mapSegment); },
    async createSegment(eventId, input: CreateSegmentInput) {
      if (!(await first("SELECT 1 FROM events WHERE id = ?", eventId))) return null;
      const posRow = await first("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM segments WHERE event_id = ?", eventId);
      const seg: Segment = {
        id: id("seg"), eventId, position: input.position ?? clampNumber(posRow?.pos),
        title: str(input.title, 160) || "Untitled segment", kind: input.kind || "session",
        speaker: str(input.speaker || "", 160), location: str(input.location || "", 160),
        startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null,
        description: str(input.description || ""), surveyId: input.surveyId ?? null,
      };
      await run(`INSERT INTO segments (id, event_id, position, title, kind, speaker, location, starts_at, ends_at, description, survey_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        seg.id, seg.eventId, seg.position, seg.title, seg.kind, seg.speaker, seg.location, seg.startsAt, seg.endsAt, seg.description, seg.surveyId);
      return seg;
    },
    async updateSegment(segmentId, patch) {
      const existing = await first("SELECT * FROM segments WHERE id = ?", segmentId);
      if (!existing) return null;
      const m = mapSegment(existing);
      const n = {
        title: patch.title !== undefined ? str(patch.title, 160) : m.title,
        kind: patch.kind !== undefined ? patch.kind : m.kind,
        speaker: patch.speaker !== undefined ? str(patch.speaker, 160) : m.speaker,
        location: patch.location !== undefined ? str(patch.location, 160) : m.location,
        startsAt: patch.startsAt !== undefined ? patch.startsAt : m.startsAt,
        endsAt: patch.endsAt !== undefined ? patch.endsAt : m.endsAt,
        description: patch.description !== undefined ? str(patch.description) : m.description,
        surveyId: patch.surveyId !== undefined ? patch.surveyId : m.surveyId,
        position: patch.position !== undefined ? clampNumber(patch.position) : m.position,
      };
      await run(`UPDATE segments SET title=?, kind=?, speaker=?, location=?, starts_at=?, ends_at=?, description=?, survey_id=?, position=? WHERE id=?`,
        n.title, n.kind, n.speaker, n.location, n.startsAt, n.endsAt, n.description, n.surveyId, n.position, segmentId);
      return { ...m, ...n };
    },
    async deleteSegment(segmentId) { await run("DELETE FROM segments WHERE id = ?", segmentId); return true; },
    async reorderSegments(eventId, orderedIds) {
      for (let i = 0; i < orderedIds.length; i += 1) await run("UPDATE segments SET position = ? WHERE id = ? AND event_id = ?", i, orderedIds[i], eventId);
    },

    async listSurveys(eventId) {
      if (eventId === undefined || eventId === null) return (await all("SELECT * FROM surveys ORDER BY created_at DESC")).map(mapSurvey);
      return (await all("SELECT * FROM surveys WHERE event_id = ? ORDER BY created_at DESC", eventId)).map(mapSurvey);
    },
    async getSurvey(surveyId) { return loadSurvey(surveyId); },
    async getSurveyByJoinCode(code) {
      const row = await first("SELECT id FROM surveys WHERE join_code = ?", String(code).toUpperCase());
      return row ? loadSurvey(row.id) : null;
    },
    async createSurvey(input: CreateSurveyInput) {
      const survey: Survey = {
        id: id("svy"), eventId: input.eventId ?? null, title: str(input.title, 160) || "Untitled survey",
        description: str(input.description || ""), audience: str(input.audience || "", 160),
        status: input.status || "draft", mode: input.mode || "standard", isLive: false,
        joinCode: await uniqueJoinCode(), createdAt: nowIso(),
      };
      await run(`INSERT INTO surveys (id, event_id, title, description, audience, status, mode, is_live, join_code, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        survey.id, survey.eventId, survey.title, survey.description, survey.audience, survey.status, survey.mode, survey.isLive ? 1 : 0, survey.joinCode, survey.createdAt);
      return survey;
    },
    async updateSurvey(surveyId, patch) {
      const existing = await first("SELECT * FROM surveys WHERE id = ?", surveyId);
      if (!existing) return null;
      const m = mapSurvey(existing);
      const n = {
        title: patch.title !== undefined ? str(patch.title, 160) : m.title,
        description: patch.description !== undefined ? str(patch.description) : m.description,
        audience: patch.audience !== undefined ? str(patch.audience, 160) : m.audience,
        status: patch.status !== undefined ? patch.status : m.status,
        mode: patch.mode !== undefined ? patch.mode : m.mode,
        eventId: patch.eventId !== undefined ? patch.eventId : m.eventId,
        isLive: patch.isLive !== undefined ? patch.isLive : m.isLive,
      };
      await run(`UPDATE surveys SET title=?, description=?, audience=?, status=?, mode=?, event_id=?, is_live=? WHERE id=?`,
        n.title, n.description, n.audience, n.status, n.mode, n.eventId, n.isLive ? 1 : 0, surveyId);
      return { ...m, ...n };
    },
    async deleteSurvey(surveyId) { await run("DELETE FROM surveys WHERE id = ?", surveyId); return true; },
    async duplicateSurvey(surveyId) {
      const source = await loadSurvey(surveyId);
      if (!source) return null;
      const clone = await store.createSurvey({
        title: `${source.title} (copy)`, eventId: source.eventId, description: source.description,
        audience: source.audience, status: "draft", mode: source.mode,
      });
      for (const q of source.questions) {
        await store.createQuestion(clone.id, { label: q.label, type: q.type, required: q.required, options: q.options, config: q.config, position: q.position });
      }
      return loadSurvey(clone.id);
    },

    async createQuestion(surveyId, input: CreateQuestionInput) {
      if (!(await first("SELECT 1 FROM surveys WHERE id = ?", surveyId))) return null;
      const posRow = await first("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM questions WHERE survey_id = ?", surveyId);
      const q: Question = {
        id: id("qn"), surveyId, position: input.position ?? clampNumber(posRow?.pos),
        label: str(input.label, 400) || "Untitled question", type: input.type,
        required: input.required ?? false, options: Array.isArray(input.options) ? input.options.map((o) => str(o, 160)) : [],
        config: input.config || {},
      };
      await run(`INSERT INTO questions (id, survey_id, position, label, type, required, options, config) VALUES (?,?,?,?,?,?,?,?)`,
        q.id, q.surveyId, q.position, q.label, q.type, q.required ? 1 : 0, JSON.stringify(q.options), JSON.stringify(q.config));
      return q;
    },
    async updateQuestion(questionId, patch) {
      const existing = await first("SELECT * FROM questions WHERE id = ?", questionId);
      if (!existing) return null;
      const m = mapQuestion(existing);
      const n = {
        label: patch.label !== undefined ? str(patch.label, 400) : m.label,
        type: patch.type !== undefined ? patch.type : m.type,
        required: patch.required !== undefined ? patch.required : m.required,
        options: patch.options !== undefined ? patch.options.map((o) => str(o, 160)) : m.options,
        config: patch.config !== undefined ? patch.config : m.config,
        position: patch.position !== undefined ? clampNumber(patch.position) : m.position,
      };
      await run(`UPDATE questions SET label=?, type=?, required=?, options=?, config=?, position=? WHERE id=?`,
        n.label, n.type, n.required ? 1 : 0, JSON.stringify(n.options), JSON.stringify(n.config), n.position, questionId);
      return { ...m, ...n };
    },
    async deleteQuestion(questionId) { await run("DELETE FROM questions WHERE id = ?", questionId); return true; },
    async reorderQuestions(surveyId, orderedIds) {
      for (let i = 0; i < orderedIds.length; i += 1) await run("UPDATE questions SET position = ? WHERE id = ? AND survey_id = ?", i, orderedIds[i], surveyId);
    },

    async createResponse(surveyId, input: CreateResponseInput) {
      const survey = await loadSurvey(surveyId);
      if (!survey) return null;
      const responseId = id("rsp");
      const createdAt = nowIso();
      const channel = str(input.channel || "web", 40);
      const note = str(input.note || "", 500);
      const respondentName = str(input.respondentName || "", 160).trim();
      await run("INSERT INTO responses (id, survey_id, created_at, channel, note, respondent_name) VALUES (?,?,?,?,?,?)",
        responseId, surveyId, createdAt, channel, note, respondentName);
      const valid = new Map(survey.questions.map((q) => [q.id, q]));
      const answers: Record<string, any> = {};
      for (const ans of input.answers || []) {
        if (!valid.has(ans.questionId)) continue;
        await run("INSERT INTO answers (id, response_id, question_id, value) VALUES (?,?,?,?)", id("ans"), responseId, ans.questionId, JSON.stringify(ans.value));
        answers[ans.questionId] = ans.value;
      }
      return { id: responseId, surveyId, createdAt, channel, note, respondentName, answers };
    },
    async listResponses(surveyId, limit = 50) {
      const rows = await all("SELECT * FROM responses WHERE survey_id = ? ORDER BY created_at DESC LIMIT ?", surveyId, limit);
      const out: ResponseWithAnswers[] = [];
      for (const row of rows) {
        const ansRows = await all("SELECT question_id, value FROM answers WHERE response_id = ?", row.id);
        const answers: Record<string, any> = {};
        for (const a of ansRows) answers[a.question_id] = safeJsonParse(a.value, a.value);
        out.push({
          id: row.id, surveyId: row.survey_id, createdAt: row.created_at, channel: row.channel,
          note: row.note, respondentName: row.respondent_name || "", answers,
        });
      }
      return out;
    },
    async countResponses(surveyId) {
      const row = await first("SELECT COUNT(*) AS c FROM responses WHERE survey_id = ?", surveyId);
      return clampNumber(row?.c);
    },
    async getAnswerRows(surveyId) {
      const rows = await all(
        `SELECT a.question_id, a.value, r.created_at FROM answers a JOIN responses r ON r.id = a.response_id WHERE r.survey_id = ?`,
        surveyId
      );
      return rows.map((r: any): AnswerRow => ({ questionId: r.question_id, value: safeJsonParse(r.value, r.value), createdAt: r.created_at }));
    },
    async getResponseMeta(surveyId) {
      const rows = await all("SELECT created_at, channel FROM responses WHERE survey_id = ? ORDER BY created_at ASC", surveyId);
      return rows.map((r: any) => ({ createdAt: r.created_at, channel: r.channel || "web" }));
    },
  };
  return store;
}
