// Relational schema for Surket. Written in portable SQL that runs identically on
// Node's built-in node:sqlite (Node / Vercel) and Cloudflare D1.
//
// Model:  events -> segments (itinerary)
//         events -> surveys -> questions
//         surveys -> responses -> answers

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  organizer   TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  starts_at   TEXT,
  theme       TEXT NOT NULL DEFAULT 'aurora',
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'session',
  speaker     TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  starts_at   TEXT,
  ends_at     TEXT,
  description TEXT NOT NULL DEFAULT '',
  survey_id   TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS surveys (
  id          TEXT PRIMARY KEY,
  event_id    TEXT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  audience    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  mode        TEXT NOT NULL DEFAULT 'standard',
  is_live     INTEGER NOT NULL DEFAULT 0,
  join_code   TEXT UNIQUE NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id        TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  position  INTEGER NOT NULL DEFAULT 0,
  label     TEXT NOT NULL,
  type      TEXT NOT NULL,
  required  INTEGER NOT NULL DEFAULT 0,
  options   TEXT NOT NULL DEFAULT '[]',
  config    TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS responses (
  id         TEXT PRIMARY KEY,
  survey_id  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'web',
  note       TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS answers (
  id          TEXT PRIMARY KEY,
  response_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  value       TEXT,
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segments_event   ON segments(event_id, position);
CREATE INDEX IF NOT EXISTS idx_surveys_event    ON surveys(event_id);
CREATE INDEX IF NOT EXISTS idx_questions_survey  ON questions(survey_id, position);
CREATE INDEX IF NOT EXISTS idx_responses_survey  ON responses(survey_id, created_at);
CREATE INDEX IF NOT EXISTS idx_answers_response  ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question  ON answers(question_id);
`;
