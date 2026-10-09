import type { ResponseWithAnswers } from "../types";

export function OpenTextResponses(props: {
  questionId: string;
  responses: ResponseWithAnswers[];
  loading: boolean;
  error: string | null;
}) {
  const answers = props.responses.flatMap((response) => {
    const value = response.answers[props.questionId];
    if (value === undefined || value === null) return [];
    const text = Array.isArray(value) ? value.join(", ") : String(value);
    if (!text.trim()) return [];
    return [{ response, text }];
  });

  if (props.loading && answers.length === 0) return <p className="faint small">Loading submitted responses…</p>;
  if (props.error && answers.length === 0) return <p className="error-text small">{props.error}</p>;
  if (answers.length === 0) return <p className="faint small">No written responses yet.</p>;

  return (
    <div className="open-text-responses">
      {props.error && <p className="error-text small">{props.error} Showing the responses already loaded.</p>}
      {answers.map(({ response, text }, index) => (
        <article className="open-text-response" key={response.id}>
          <div className="row between">
            <strong>{response.respondentName || `Response ${index + 1}`}</strong>
            <time className="small faint" dateTime={response.createdAt}>{new Date(response.createdAt).toLocaleString()}</time>
          </div>
          <p>{text}</p>
        </article>
      ))}
      {props.responses.length === 100 && (
        <p className="faint small">Showing the 100 most recent submissions.</p>
      )}
    </div>
  );
}
