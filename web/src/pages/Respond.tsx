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
import { Link } from "../router";
import { saveAttendeeHistoryEntry } from "../lib/attendeeHistory";

export function Respond(props: { surveyId: string }) {
  const { surveyId } = props;
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [started, setStarted] = useState(false);
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
    if (!firstName.trim() || !lastName.trim()) {
      toast.push("Enter your first and last name to continue", "err");
      return;
    }
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
      const respondentName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const result = await api.submitResponse(surveyId, {
        channel: "web", note: note.trim(), respondentName, answers: payload,
      });
      try {
        const questionLabels = new Map(survey.questions.map((question) => [question.id, question.label]));
        saveAttendeeHistoryEntry({
          responseId: result.response.id,
          surveyId,
          eventId: survey.eventId,
          surveyTitle: survey.title,
          submittedAt: result.response.createdAt,
          answers: Object.entries(result.response.answers).map(([questionId, value]) => ({
            label: questionLabels.get(questionId) || "Survey answer",
            value,
          })),
          note: result.response.note,
        });
      } catch {
        toast.push("Your response was submitted, but this browser could not save it in your history.", "err");
      }
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
  if (!started) {
    return (
      <div className="respond welcome-respond">
        <ColorBends colors={["#12c957", "#0c6b35", "#9af5bd"]} opacity={0.1} />
        <Link to="/attendee" className="attendee-back-link">← Back to GAIC events</Link>
        <Card className="respond-welcome-card">
          <a className="respond-welcome-brand" href="https://www.gaic.co.za/" target="_blank" rel="noreferrer">
            <img src="/GAIC logo Color.png" alt="GAIC" />
            <span>GAUTENG AI COMMUNITY</span>
          </a>
          <div className="eyebrow">{survey.audience || "Community survey"}</div>
          <SplitText text={survey.title} tag="h1" className="respond-welcome-title" splitType="chars" delay={18} duration={0.3} fromY={10} />
          {survey.description && <p className="muted respond-welcome-description">{survey.description}</p>}
          <div className="respond-gaic-intro">
            <h2>Welcome to GAIC</h2>
            <p>
              The Gauteng AI Community brings people together to learn about AI, build real-world
              solutions, launch new ventures, and connect with the wider African tech ecosystem.
            </p>
            <div className="respond-pillars">
              <span>Learn</span><span>Build</span><span>Launch</span><span>Connect</span>
            </div>
            <a href="https://www.gaic.co.za/" target="_blank" rel="noreferrer">Discover GAIC <span aria-hidden="true">↗</span></a>
          </div>
          <form className="respond-name-form" onSubmit={(event) => {
            event.preventDefault();
            if (!firstName.trim() || !lastName.trim()) {
              toast.push("Enter your first and last name to continue", "err");
              return;
            }
            setFirstName(firstName.trim());
            setLastName(lastName.trim());
            setStarted(true);
          }}>
            <div>
              <h2>Before we begin</h2>
              <p className="muted small">Tell us your name so the organisers can understand who took part. No account or sign-in needed.</p>
            </div>
            <div className="respond-name-fields">
              <label className="field">
                <span className="label">First name</span>
                <input className="input" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} required autoFocus />
              </label>
              <label className="field">
                <span className="label">Last name</span>
                <input className="input" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} required />
              </label>
            </div>
            <p className="respond-name-notice">Your name will be saved with your survey response and visible to the event organisers.</p>
            <Button type="submit" variant="primary" size="lg" block>Continue to survey <span aria-hidden="true">→</span></Button>
          </form>
          <p className="faint small respond-welcome-footer">No sign-in required · Powered by GAIC</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="respond" style={respondWrapStyle}>
      <ColorBends colors={["#5227FF", "#FF9FFC", "#7cff67"]} opacity={0.06} />
      <Link to="/attendee" className="attendee-back-link">← Browse GAIC events</Link>
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
      <p className="faint small" style={footStyle}>Powered by Surket \u00b7 GAIC</p>
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
        <Link to="/attendee" className="btn btn-primary attendee-thanks-link">Return to your event dashboard</Link>
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
