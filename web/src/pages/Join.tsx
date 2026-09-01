// Attendee join surface.
//
// Two entry points:
//  - <Join />        the manual landing at /join (big code entry + scan prompt)
//  - <JoinConfirm /> the auto-join confirm at /j/:code (opened by scanning a QR)
//
// Both are branded, mobile-first, and show the survey's live open/closed status
// so attendees know whether the room is taking responses right now.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { SurveyWithQuestions } from "../types";
import { useRouter } from "../router";
import { Button, Card, Field, Spinner, useToast } from "../components/ui";
import { IconQr, IconBroadcast, IconArrowRightCircle, IconCheckCircle, IconClose } from "../components/icons";
import { LiveDot } from "../components/icons";
import { useReveal } from "../lib/motion";
import { ColorBends } from "../components/reactbits/ColorBends";
import { SplitText } from "../components/reactbits/SplitText";

function Brand() {
  return (
    <div className="join-brand">
      <div className="join-logo" aria-hidden="true"><IconBroadcast size={22} /></div>
      <div>
        <div className="join-word">Gauteng AI Community</div>
        <div className="join-tag">Powered by Lehro Solutions</div>
      </div>
    </div>
  );
}

function statusTone(status: string): { label: string; live: boolean } {
  if (status === "live") return { label: "Open for responses", live: true };
  if (status === "paused") return { label: "Paused by host", live: false };
  if (status === "closed") return { label: "Closed", live: false };
  return { label: "Not started yet", live: false };
}

export function Join() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { navigate } = useRouter();
  const toast = useToast();
  const reveal = useReveal<HTMLDivElement>(0);

  const go = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setBusy(true);
    try {
      const survey = await api.joinSurvey(clean);
      navigate(`/r/${survey.id}`);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Code not found", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="join-screen">
      <ColorBends colors={["#27ff39", "#27ff39", "#7cff67"]} opacity={0.18} />
      <div className="join-wrap reveal" ref={reveal}>
        <Brand />
        <Card style={joinCardStyle}>
          <div className="join-icon" aria-hidden="true"><IconQr size={30} /></div>
          <h1 className="join-title"><SplitText text="Join the live survey" tag="span" splitType="chars" delay={25} duration={0.4} fromY={15} /></h1>
          <p className="join-sub">Enter the code shown on the big screen, or scan the QR code with your phone camera to jump straight in.</p>
          <Field label="Survey code">
            <input
              className="input join-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") go(); }}
              placeholder="AI-2026"
              autoFocus
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Survey code"
            />
          </Field>
          <Button variant="primary" block onClick={go} disabled={busy}>
            {busy ? "Opening\u2026" : "Join survey"} <IconArrowRightCircle size={17} />
          </Button>
          <div className="join-scan-hint">
            <IconQr size={15} /> Scanning a QR code opens your survey automatically.
          </div>
        </Card>
      </div>
    </div>
  );
}

export function JoinConfirm(props: { code: string }) {
  const { code } = props;
  const clean = code.trim().toUpperCase();
  const { navigate } = useRouter();
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reveal = useReveal<HTMLDivElement>(0);

  useEffect(() => {
    let active = true;
    api.joinSurvey(clean)
      .then((s) => { if (active) setSurvey(s); })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : "This code is not valid."); });
    return () => { active = false; };
  }, [clean]);

  if (error) {
    return (
      <div className="join-screen">
        <div className="join-wrap">
          <Brand />
          <Card style={joinCardStyle}>
            <div className="join-icon bad" aria-hidden="true"><IconClose size={28} /></div>
            <h1 className="join-title">Code not found</h1>
            <p className="join-sub">{error} Double-check the code on screen, or enter it manually.</p>
            <Button variant="primary" block onClick={() => navigate("/join")}>Enter code manually</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!survey) {
    return <div className="join-screen"><div className="center-screen"><Spinner /></div></div>;
  }

  const st = statusTone(survey.status);
  return (
    <div className="join-screen">
      <div className="join-wrap reveal" ref={reveal}>
        <Brand />
        <Card style={joinCardStyle}>
          <div className="join-icon good" aria-hidden="true"><IconCheckCircle size={30} /></div>
          <div className="join-code-pill">Code {survey.joinCode}</div>
          <h1 className="join-title">{survey.title}</h1>
          <div className={`join-status ${st.live ? "is-live" : "is-off"}`}>
            {st.live ? <LiveDot size={9} /> : <span className="dot-static" aria-hidden="true" />}
            {st.label}
          </div>
          <p className="join-sub">{survey.description || "You're about to join this live survey. Your responses appear on the big screen in real time."}</p>
          <Button variant="primary" block onClick={() => navigate(`/r/${survey.id}`)}>
            {st.live ? "Join now" : "Open survey"} <IconArrowRightCircle size={17} />
          </Button>
          <button className="join-link" onClick={() => navigate("/join")}>Use a different code</button>
        </Card>
      </div>
    </div>
  );
}

const joinCardStyle: CSSProperties = { width: "100%", maxWidth: 440, textAlign: "center" };
