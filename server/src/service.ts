// Service layer: the single place that composes the Store, the pure aggregate
// engine, and the live hub. Both the Node server and the Cloudflare worker call
// these functions so behaviour stays identical across runtimes.

import { computeResults, type ResponseMeta } from "./aggregate.js";
import { surveyTopic, type LiveHub } from "./live.js";
import type {
  CreateResponseInput,
  Store,
  SurveyResults,
  SurveyWithQuestions,
} from "./types.js";

export async function getSurveyResults(
  store: Store,
  surveyId: string
): Promise<{ survey: SurveyWithQuestions; results: SurveyResults } | null> {
  const survey = await store.getSurvey(surveyId);
  if (!survey) return null;
  const rows = await store.getAnswerRows(surveyId);
  const meta = (await store.getResponseMeta(surveyId)) as ResponseMeta[];
  const results = computeResults(survey, rows, meta);
  return { survey, results };
}

// Record a response and immediately broadcast the recomputed live tally.
export async function submitResponse(
  store: Store,
  hub: LiveHub | null,
  surveyId: string,
  input: CreateResponseInput
) {
  const response = await store.createResponse(surveyId, input);
  if (!response) return null;
  const snapshot = await getSurveyResults(store, surveyId);
  if (snapshot && hub) {
    hub.publish(surveyTopic(surveyId), {
      type: "results",
      surveyId,
      results: snapshot.results,
    });
  }
  return { response, results: snapshot?.results ?? null };
}
