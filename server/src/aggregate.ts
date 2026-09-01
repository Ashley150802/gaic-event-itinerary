// Pure analytics + live-tally engine. No I/O, no framework, no driver -- so it is
// trivially unit-testable and identical across Node and Cloudflare runtimes.

import type {
  AnswerRow,
  AnswerValue,
  Keyword,
  Question,
  QuestionTally,
  SurveyResults,
  SurveyWithQuestions,
} from "./types.js";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "are", "was", "were",
  "have", "has", "had", "from", "but", "not", "more", "would", "could",
  "there", "their", "about", "into", "over", "very", "really", "just",
  "feel", "need", "make", "please", "your", "been", "than", "when", "what",
  "which", "who", "how", "why", "can", "will", "too", "via", "our", "out",
  "all", "any", "its", "they", "them", "some", "like", "also", "much",
]);

const POSITIVE_WORDS = new Set([
  "good", "great", "excellent", "love", "loved", "amazing", "awesome", "helpful",
  "fast", "easy", "clear", "premium", "strong", "smooth", "intuitive", "useful",
  "fantastic", "perfect", "happy", "enjoyed", "responsive", "reliable", "best",
  "impressive", "polished", "delightful", "recommend",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "poor", "slow", "confusing", "hard", "difficult", "crowded", "broken",
  "buggy", "expensive", "frustrating", "frustrated", "unclear", "disappointing",
  "disappointed", "lacking", "missing", "crash", "crashed", "error", "worst",
  "annoying", "clunky", "laggy", "painful", "weak",
]);

function isNumericType(type: Question["type"]): boolean {
  return type === "rating" || type === "number" || type === "nps" || type === "scale";
}

function toNumber(value: AnswerValue): number | null {
  if (Array.isArray(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function answeredValue(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

function tallyQuestion(question: Question, values: AnswerValue[]): QuestionTally {
  const answered = values.filter(answeredValue);
  const base: QuestionTally = {
    questionId: question.id,
    label: question.label,
    type: question.type,
    total: answered.length,
    buckets: [],
    average: null,
    npsScore: null,
  };

  if (question.type === "single" || question.type === "multi") {
    const counts = new Map<string, number>();
    for (const opt of question.options) counts.set(opt, 0);
    for (const value of answered) {
      const selections = Array.isArray(value) ? value : [value];
      for (const sel of selections) {
        const key = String(sel);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    base.buckets = Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
    return base;
  }

  if (question.type === "rating") {
    const min = question.config.min ?? 1;
    const max = question.config.max ?? 5;
    const counts = new Map<number, number>();
    for (let i = min; i <= max; i += 1) counts.set(i, 0);
    const nums: number[] = [];
    for (const value of answered) {
      const n = toNumber(value);
      if (n === null) continue;
      nums.push(n);
      counts.set(n, (counts.get(n) || 0) + 1);
    }
    base.buckets = Array.from(counts.entries()).map(([k, v]) => ({ label: String(k), value: v }));
    base.average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    return base;
  }

  if (question.type === "scale") {
    const min = question.config.min ?? 0;
    const max = question.config.max ?? 10;
    const counts = new Map<number, number>();
    for (let i = min; i <= max; i += 1) counts.set(i, 0);
    const nums: number[] = [];
    for (const value of answered) {
      const n = toNumber(value);
      if (n === null) continue;
      nums.push(n);
      if (counts.has(n)) counts.set(n, (counts.get(n) || 0) + 1);
    }
    base.buckets = Array.from(counts.entries()).map(([k, v]) => ({ label: String(k), value: v }));
    base.average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    return base;
  }

  if (question.type === "nps") {
    const nums = answered.map(toNumber).filter((n): n is number => n !== null);
    let detractors = 0;
    let passives = 0;
    let promoters = 0;
    for (const n of nums) {
      if (n <= 6) detractors += 1;
      else if (n <= 8) passives += 1;
      else promoters += 1;
    }
    base.buckets = [
      { label: "Detractors (0-6)", value: detractors },
      { label: "Passives (7-8)", value: passives },
      { label: "Promoters (9-10)", value: promoters },
    ];
    base.average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    base.npsScore = nums.length
      ? Math.round(((promoters - detractors) / nums.length) * 100)
      : null;
    return base;
  }

  if (question.type === "number") {
    const nums = answered.map(toNumber).filter((n): n is number => n !== null);
    if (nums.length) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const buckets = 6;
      const span = Math.max(max - min, 1);
      const counts = new Array(buckets).fill(0);
      for (const n of nums) {
        const idx = Math.min(Math.floor(((n - min) / span) * buckets), buckets - 1);
        counts[idx] += 1;
      }
      base.buckets = counts.map((value, i) => {
        const start = Math.round(min + (span / buckets) * i);
        const end = Math.round(min + (span / buckets) * (i + 1));
        return { label: i === buckets - 1 ? `${start}+` : `${start}-${end}`, value };
      });
      base.average = nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    return base;
  }

  // text / date -> no chart buckets
  return base;
}

export function extractKeywords(texts: string[], limit = 8): Keyword[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const tokens = String(text).toLowerCase().match(/[a-z0-9']+/g) || [];
    for (const token of tokens) {
      if (token.length < 3 || STOP_WORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function scoreSentiment(texts: string[]): { positive: number; neutral: number; negative: number } {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const text of texts) {
    const tokens = String(text).toLowerCase().match(/[a-z']+/g) || [];
    let score = 0;
    for (const t of tokens) {
      if (POSITIVE_WORDS.has(t)) score += 1;
      if (NEGATIVE_WORDS.has(t)) score -= 1;
    }
    if (score > 0) positive += 1;
    else if (score < 0) negative += 1;
    else neutral += 1;
  }
  return { positive, neutral, negative };
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

/**
 * Build the full results object for a survey.
 * `version` is the live-tally cursor (total responses), so clients can cheaply
 * detect whether a new poll/broadcast contains fresh data.
 */
export interface ResponseMeta {
  createdAt: string;
  channel: string;
}

export function computeResults(
  survey: SurveyWithQuestions,
  rows: AnswerRow[],
  responseMeta: ResponseMeta[]
): SurveyResults {
  const responseTimes = responseMeta.map((r) => r.createdAt);
  const byQuestion = new Map<string, AnswerValue[]>();
  for (const q of survey.questions) byQuestion.set(q.id, []);
  for (const row of rows) {
    if (!byQuestion.has(row.questionId)) byQuestion.set(row.questionId, []);
    byQuestion.get(row.questionId)!.push(row.value);
  }

  const questions = survey.questions.map((q) => tallyQuestion(q, byQuestion.get(q.id) || []));

  const totalResponses = responseTimes.length;

  // completion rate: share of responses that answered every required question
  const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id);
  let completionRate = 1;
  if (requiredIds.length && totalResponses) {
    // group answers by response is not available here; approximate via per-question coverage
    const minCoverage = Math.min(
      ...requiredIds.map((qid) => {
        const t = questions.find((x) => x.questionId === qid);
        return t ? t.total : 0;
      })
    );
    completionRate = totalResponses ? minCoverage / totalResponses : 0;
  }

  // headline average across rating questions; headline nps across nps questions
  const ratingAverages = questions
    .filter((q) => q.type === "rating" && q.average !== null)
    .map((q) => q.average as number);
  const averageRating = ratingAverages.length
    ? ratingAverages.reduce((a, b) => a + b, 0) / ratingAverages.length
    : null;
  const npsQuestion = questions.find((q) => q.type === "nps" && q.npsScore !== null);
  const npsScore = npsQuestion ? npsQuestion.npsScore : null;

  // text analysis across all text questions
  const textTypeIds = new Set(survey.questions.filter((q) => q.type === "text").map((q) => q.id));
  const texts: string[] = [];
  for (const row of rows) {
    if (textTypeIds.has(row.questionId) && typeof row.value === "string") texts.push(row.value);
  }
  const keywords = extractKeywords(texts);
  const sentiment = scoreSentiment(texts);

  // 7-day trend
  const dayMap = new Map<string, number>();
  const days: { key: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const key = d.toDateString();
    dayMap.set(key, 0);
    days.push({ key, label: formatShortDate(d) });
  }
  for (const iso of responseTimes) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const key = d.toDateString();
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const daily = days.map((d) => ({ label: d.label, value: dayMap.get(d.key) || 0 }));

  // channel mix
  const channelMap = new Map<string, number>();
  for (const r of responseMeta) {
    const c = r.channel || "web";
    channelMap.set(c, (channelMap.get(c) || 0) + 1);
  }
  const channels = Array.from(channelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return {
    surveyId: survey.id,
    totalResponses,
    completionRate,
    averageRating,
    npsScore,
    sentiment,
    questions,
    daily,
    channels,
    keywords,
    version: totalResponses,
  };
}
