// Public respond view (mobile-first). No auth required. After submitting, the
// respondent sees a live summary if the survey is in live mode.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { SurveyWithQuestions } from "../types";
import { QuestionInput, type AnswerValue } from "../components/QuestionInput";
import { BarChart } from "../components/charts";
import { Button, Card, Spinner, Badge, useToast } from "../components/ui";
import { useLiveTally } from "../hooks/useLiveTally";
import { IconParty } from "../components/icons";
import { ColorBends } from "../components/reactbits/ColorBends";
import { SplitText } from "../components/reactbits/SplitText";
import { Counter } from "../components/reactbits/Counter";

export function Respond(props: { surveyId: string }) {
  const { surveyId } = props;
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getSurvey(surveyId)
      .then((s) => { setSurvey(s); document.body.className = ""; })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Survey unavailable"));
  }, [surveyId]);

  const setAnswer = (qid: string, v: AnswerValue) => setAnswers((a) => ({ ...a, [qid]: v }));

  const submit = async () => {
    if (!survey) return;
    for (const q of survey.questions) {
      if (q.required) {
        const v = answers[q.id];
        const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) { toast.push(`Please answer: ${q.label}`, "err"); return; }
      }
    }
    setBusy(true);
    try {
      const payload = survey.questions
        .map((q) => ({ questionId: q.id, value: answers[q.id] }))
        .filter((a) => a.value !== null && a.value !== undefined && a.value !== "");
      await api.submitResponse(surveyId, { channel: "web", note: note.trim(), answers: payload });
      setSubmitted(true);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Could not submit", "err");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="respond"><Card><p className="error-text">{error}</p></Card></div>;
  if (!survey) return <div className="center-screen"><Spinner /></div>;
  if (survey.status === "closed") return <div className="respond"><Card><h2>This survey is closed</h2><p className="muted">Thanks for your interest \u2014 responses are no longer being collected.</p></Card></div>;
  if (submitted) return <ThankYou survey={survey} />;

  return (
    <div className="respond" style={respondWrapStyle}>
      <ColorBends colors={["#5227FF", "#FF9FFC", "#7cff67"]} opacity={0.06} />
      <div className="row between" style={headStyle}>
        <div>
          <div className="eyebrow">{survey.audience || "Survey"}</div>
          <SplitText text={survey.title} tag="h1" splitType="chars" delay={20} duration={0.35} fromY={12} />
        </div>
        {survey.isLive && <Badge tone="live" dot pulse>Live</Badge>}
      </div>
      {survey.description && <p className="muted" style={descStyle}>{survey.description}</p>}

      {survey.questions.map((q, i) => (
        <Card key={q.id} className="q-card">
          <div className="q-label">{i + 1}. {q.label}{q.required && <span className="req-star">*</span>}</div>
          <QuestionInput question={q} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} />
        </Card>
      ))}

      <Card className="q-card">
        <div className="q-label">Anything else to add?</div>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional comments\u2026" />
      </Card>

      <Button variant="primary" size="lg" block onClick={submit} disabled={busy}>{busy ? "Submitting\u2026" : "Submit response"}</Button>
      <p className="faint small" style={footStyle}>Powered by Surket \u00b7 Lehro Solutions</p>
    </div>
  );
}

function ThankYou(props: { survey: SurveyWithQuestions }) {
  const { survey } = props;
  const live = useLiveTally(survey.isLive ? survey.id : null);
  const firstChoice = survey.questions.find((q) => q.type === "single" || q.type === "multi");
  const tally = live.results?.questions.find((q) => q.questionId === firstChoice?.id);
  return (
    <div className="respond">
      <Card style={thanksStyle}>
        <div className="thanks-icon"><IconParty size={44} /></div>
        <h1>Thank you!</h1>
        <p className="muted">Your response has been recorded.</p>
      </Card>
      {survey.isLive && tally && (
        <Card style={liveResultStyle}>
          <div className="row between" style={liveHeadStyle}>
            <strong>Live results</strong>
            <Badge tone="live" dot pulse><Counter value={live.results?.totalResponses ?? 0} fontSize={13} gap={0} textColor="var(--good)" fontWeight={700} duration={500} /> responses</Badge>
          </div>
          <p className="muted small" style={qStyle}>{tally.label}</p>
          <BarChart buckets={tally.buckets} />
        </Card>
      )}
    </div>
  );
}

const headStyle: CSSProperties = { marginBottom: 6 };
const respondWrapStyle: CSSProperties = { position: "relative", overflow: "hidden" };
const titleStyle: CSSProperties = { fontSize: 24, marginTop: 4 };
const descStyle: CSSProperties = { marginBottom: 18 };
const footStyle: CSSProperties = { textAlign: "center", marginTop: 22 };
const thanksStyle: CSSProperties = { textAlign: "center", padding: 30 };
const liveResultStyle: CSSProperties = { marginTop: 16 };
const liveHeadStyle: CSSProperties = { marginBottom: 12 };
const qStyle: CSSProperties = { marginBottom: 12 };
