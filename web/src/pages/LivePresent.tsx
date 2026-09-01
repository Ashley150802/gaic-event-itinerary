// Full-screen present view for the big screen. Shows the join code and an
// animated live tally that updates as responses arrive.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { SurveyWithQuestions } from "../types";
import { Spinner, Badge } from "../components/ui";
import { useLiveTally } from "../hooks/useLiveTally";
import { QrCanvas } from "../components/Share";
import { useSettings } from "../lib/settings";
import { Counter } from "../components/reactbits/Counter";
import { ColorBends } from "../components/reactbits/ColorBends";

export function LivePresent(props: { surveyId: string }) {
  const { surveyId } = props;
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const live = useLiveTally(surveyId, 3000);
  const { settings } = useSettings();
  const pres = settings.presentation;

  useEffect(() => {
    api.getSurvey(surveyId).then(setSurvey).catch((e) => setError(e instanceof ApiError ? e.message : "Unavailable"));
  }, [surveyId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!survey) return;
      if (e.key === "ArrowRight") setQIndex((i) => Math.min(i + 1, survey.questions.length - 1));
      if (e.key === "ArrowLeft") setQIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [survey]);

  if (error) return <div className="center-screen"><p className="error-text">{error}</p></div>;
  if (!survey) return <div className="center-screen"><Spinner /></div>;

  const question = survey.questions[qIndex];
  const tally = live.results?.questions.find((q) => q.questionId === question?.id);
  const max = Math.max(1, ...(tally?.buckets.map((b) => b.value) ?? [1]));
  const joinUrl = `${location.host}/join`;
  const scanUrl = `${location.origin}/j/${survey.joinCode}`;
  const tallyTotal = tally?.total ?? 0;
  const rootStyle: CSSProperties = { ["--q-scale" as string]: String(pres.fontScale) } as CSSProperties;

  return (
    <div className={`present theme-${"aurora"}`} style={rootStyle}>
      <ColorBends colors={["#5227FF", "#FF9FFC", "#7cff67"]} opacity={0.08} />
      <div className="present-head">
        <div>
          <div className="eyebrow">{survey.title}</div>
          <div className="row" style={statusRowStyle}>
            <Badge tone={live.connected ? "live" : "default"} dot pulse={live.connected}>
              {live.connected ? "Live" : live.transport === "polling" ? "Live (polling)" : "Connecting"}
            </Badge>
            <span className="muted"><Counter value={live.results?.totalResponses ?? 0} fontSize={16} gap={1} textColor="var(--text-muted)" fontWeight={600} duration={500} /> responses</span>
          </div>
        </div>
        <div style={joinBoxStyle}>
          <div className="small muted">Join at {joinUrl}</div>
          <div className="join-code">{survey.joinCode}</div>
          {pres.showQr && <div className="present-qr"><QrCanvas value={scanUrl} size={130} ecc="medium" /></div>}
        </div>
      </div>

      <div style={qWrapStyle}>
        <div className="present-q">{question ? question.label : "No questions yet"}</div>
      </div>

      <div className="present-bars">
        {tally && tally.buckets.length > 0 ? tally.buckets.map((b, i) => {
          const fillStyle: CSSProperties = { width: `${Math.round((b.value / max) * 100)}%` };
          const pct = tallyTotal > 0 ? Math.round((b.value / tallyTotal) * 100) : 0;
          return (
            <div className="present-bar-row" key={i}>
              <div className="present-bar-label">{b.label}</div>
              <div className="present-track"><div className="present-fill" style={fillStyle} /></div>
              <div className="present-val count-flip">{b.value}{pres.showPercentages ? <span className="present-pct"> {pct}%</span> : null}</div>
            </div>
          );
        }) : (
          <p className="muted">Waiting for responses\u2026 open answers and ratings tally live here.</p>
        )}
      </div>

      <div className="present-head" style={navStyle}>
        <span className="muted small">Question {qIndex + 1} of {survey.questions.length} \u00b7 use \u2190 \u2192 to navigate</span>
        <span className="muted small">Surket \u00b7 Lehro Solutions</span>
      </div>
    </div>
  );
}

const statusRowStyle: CSSProperties = { marginTop: 8, gap: 14 };
const joinBoxStyle: CSSProperties = { textAlign: "right" };
const qWrapStyle: CSSProperties = { flex: 1, display: "flex", alignItems: "center" };
const navStyle: CSSProperties = { marginTop: "auto" };
