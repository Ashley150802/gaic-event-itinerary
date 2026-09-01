// DB-logic verification harness.
//
// It exercises the REAL store + aggregate + templates + seed + service code
// against Node's built-in `node:sqlite` (injected as the SqliteDriver), so we
// prove the data layer works without needing any native SQLite dependency or a network.
//
// Run via: esbuild bundle -> node (see scripts/verify-db.mjs wrapper / README).

import { DatabaseSync } from "node:sqlite";
import { createSqliteStore, type SqliteDriver } from "../server/src/sqliteStore.js";
import { seedDemoData } from "../server/src/seed.js";
import { getSurveyResults, submitResponse } from "../server/src/service.js";
import { listTemplates, applyEventTemplate, applySurveyTemplate } from "../server/src/templates.js";
import { computeResults, scoreSentiment, extractKeywords } from "../server/src/aggregate.js";
import { LiveHub, surveyTopic } from "../server/src/live.js";

let failures = 0;
let passes = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passes++; console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
function section(t: string) { console.log("\n" + t); }

function newStore() {
  const db = new DatabaseSync(":memory:");
  return createSqliteStore(db as unknown as SqliteDriver);
}

async function main() {
  section("1. Schema + init");
  const store = newStore();
  await store.init();
  const events0 = await store.listEvents();
  check("fresh DB has no events", events0.length === 0, events0.length);

  section("2. Seed demo data");
  await seedDemoData(store);
  const events1 = await store.listEvents();
  check("seed creates at least one event", events1.length >= 1, events1.length);
  const demo = events1[0];
  const demoSurveys = await store.listSurveys(demo.id);
  check("seed event has surveys", demoSurveys.length >= 1, demoSurveys.length);
  const demoSegments = await store.listSegments(demo.id);
  check("seed event has itinerary segments", demoSegments.length >= 1, demoSegments.length);
  let seededWithResponses = 0;
  for (const s of demoSurveys) {
    const c = await store.countResponses(s.id);
    seededWithResponses += c;
  }
  check("seed recorded demo responses", seededWithResponses > 0, seededWithResponses);
  // idempotency: seeding again must not duplicate
  await seedDemoData(store);
  const events2 = await store.listEvents();
  check("seed is idempotent (no duplicate events)", events2.length === events1.length, { before: events1.length, after: events2.length });

  section("3. Templates");
  const catalog = listTemplates();
  check("survey templates present", catalog.surveys.length >= 3, catalog.surveys.length);
  check("event templates present", catalog.events.length >= 1, catalog.events.length);
  check("survey templates expose questionCount", catalog.surveys.every((s) => typeof s.questionCount === "number"));

  const store2 = newStore();
  await store2.init();
  const ev = await applyEventTemplate(store2, catalog.events[0].id);
  check("applyEventTemplate returns an event", !!ev, ev?.id);
  if (ev) {
    const segs = await store2.listSegments(ev.id);
    const srvs = await store2.listSurveys(ev.id);
    check("event template created segments", segs.length >= 1, segs.length);
    check("event template created surveys", srvs.length >= 1, srvs.length);
    const linked = segs.find((s) => s.surveyId);
    check("a survey-kind segment is linked to a survey", !!linked, linked?.surveyId);
  }
  const tplSurvey = await applySurveyTemplate(store2, catalog.surveys[0].id);
  check("applySurveyTemplate returns survey with questions", !!tplSurvey && tplSurvey.questions.length > 0, tplSurvey?.questions.length);
  check("unknown template id returns null", (await applySurveyTemplate(store2, "does-not-exist")) === null);

  section("4. Single-choice tally");
  const store3 = newStore();
  await store3.init();
  const survey = await store3.createSurvey({ title: "Poll", mode: "live" });
  const q = await store3.createQuestion(survey.id, { label: "Favourite?", type: "single", required: true, options: ["Alpha", "Beta", "Gamma"] });
  check("question created", !!q, q?.id);
  const plan: string[] = ["Alpha", "Alpha", "Alpha", "Beta", "Gamma", "Gamma"];
  for (const choice of plan) {
    await store3.createResponse(survey.id, { channel: "web", answers: [{ questionId: q!.id, value: choice }] });
  }
  const snap = await getSurveyResults(store3, survey.id);
  check("results computed", !!snap, !!snap);
  const tally = snap!.results.questions[0];
  const bucket = (l: string) => tally.buckets.find((b) => b.label === l)?.value ?? 0;
  check("total responses = 6", snap!.results.totalResponses === 6, snap!.results.totalResponses);
  check("Alpha = 3", bucket("Alpha") === 3, bucket("Alpha"));
  check("Beta = 1", bucket("Beta") === 1, bucket("Beta"));
  check("Gamma = 2", bucket("Gamma") === 2, bucket("Gamma"));
  check("version reflects 6 responses", snap!.results.version === 6, snap!.results.version);

  section("5. NPS computation");
  const store4 = newStore();
  await store4.init();
  const npsSurvey = await store4.createSurvey({ title: "NPS", mode: "standard" });
  const npsQ = await store4.createQuestion(npsSurvey.id, { label: "Recommend?", type: "nps" });
  const scores = [10, 10, 9, 8, 7, 0, 5]; // promoters=3, passives=2, detractors=2, n=7
  for (const sc of scores) {
    await store4.createResponse(npsSurvey.id, { answers: [{ questionId: npsQ!.id, value: sc }] });
  }
  const npsSnap = await getSurveyResults(store4, npsSurvey.id);
  const expectedNps = Math.round(((3 - 2) / 7) * 100); // 14
  check("nps score correct", npsSnap!.results.questions[0].npsScore === expectedNps, { got: npsSnap!.results.questions[0].npsScore, expected: expectedNps });
  check("survey-level nps populated", npsSnap!.results.npsScore === expectedNps, npsSnap!.results.npsScore);

  section("6. Sentiment + keywords");
  const sentiment = scoreSentiment(["This was great and really helpful", "slow and confusing experience", "it was okay"]);
  check("positive sentiment detected", sentiment.positive >= 1, sentiment);
  check("negative sentiment detected", sentiment.negative >= 1, sentiment);
  const kw = extractKeywords(["workshop workshop networking", "workshop content great"]);
  check("keyword extraction ranks repeated term first", kw.length > 0 && kw[0].word === "workshop", kw.slice(0, 3));

  section("7. Live hub broadcast on submit");
  const store5 = newStore();
  await store5.init();
  const liveSurvey = await store5.createSurvey({ title: "Live", mode: "live" });
  const liveQ = await store5.createQuestion(liveSurvey.id, { label: "Rate", type: "rating", config: { max: 5 } });
  const hub = new LiveHub();
  let received: any = null;
  const unsub = hub.subscribe(surveyTopic(liveSurvey.id), (payload) => { received = payload; });
  const out = await submitResponse(store5, hub, liveSurvey.id, { answers: [{ questionId: liveQ!.id, value: 4 }] });
  check("submitResponse returns response + results", !!out && !!out.results, !!out);
  check("hub received a live results broadcast", received && received.type === "results" && received.surveyId === liveSurvey.id, received?.type);
  check("broadcast carries updated total", received?.results?.totalResponses === 1, received?.results?.totalResponses);
  unsub();
  const out2 = await submitResponse(store5, hub, liveSurvey.id, { answers: [{ questionId: liveQ!.id, value: 2 }] });
  check("unsubscribe stops delivery (received stays at total 1)", received?.results?.totalResponses === 1, received?.results?.totalResponses);
  check("average rating after two ratings = 3", out2!.results!.averageRating === 3, out2!.results!.averageRating);

  section("8. Survey lifecycle + duplicate");
  const dup = await store5.duplicateSurvey(liveSurvey.id);
  check("duplicate clones questions", !!dup && dup.questions.length === 1, dup?.questions.length);
  check("duplicate has a fresh join code", !!dup && dup.joinCode !== liveSurvey.joinCode, { a: liveSurvey.joinCode, b: dup?.joinCode });
  check("duplicate starts with zero responses", (await store5.countResponses(dup!.id)) === 0);
  const byCode = await store5.getSurveyByJoinCode(liveSurvey.joinCode);
  check("lookup by join code works", !!byCode && byCode.id === liveSurvey.id, byCode?.id);

  console.log(`\n==== ${passes} passed, ${failures} failed ====`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
