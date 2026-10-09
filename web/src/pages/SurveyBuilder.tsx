// Survey builder: edit survey meta, manage questions (add / edit / reorder /
// delete), toggle live mode, duplicate, and preview live results.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { Question, QuestionType, SurveyWithQuestions } from "../types";
import { Link, useRouter } from "../router";
import { Button, Card, Badge, Spinner, Empty, Modal, Field, useToast, QUESTION_TYPE_LABELS } from "../components/ui";
import { QuestionInput, type AnswerValue } from "../components/QuestionInput";
import { BarChart, StatTile } from "../components/charts";
import { useLiveTally } from "../hooks/useLiveTally";
import { SharePanel } from "../components/Share";
import { IconArrowLeft, IconChevronUp, IconChevronDown, IconClose, IconHelpCircle, IconInbox, IconShare } from "../components/icons";
import { SplitText } from "../components/reactbits/SplitText";
import { OpenTextResponses } from "../components/OpenTextResponses";
import { useSurveyResponses } from "../hooks/useSurveyResponses";

const NEEDS_OPTIONS: QuestionType[] = ["single", "multi"];

export function SurveyBuilder(props: { surveyId: string }) {
  const { surveyId } = props;
  const [survey, setSurvey] = useState<SurveyWithQuestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<"build" | "preview" | "results">("build");
  const toast = useToast();
  const { navigate } = useRouter();

  const load = async () => {
    try { setSurvey(await api.getSurvey(surveyId)); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not load survey"); }
  };
  useEffect(() => { load(); }, [surveyId]);

  if (error) return <div className="page"><Card><p className="error-text">{error}</p></Card></div>;
  if (!survey) return <div className="page"><div className="center-screen"><Spinner /></div></div>;

  const patch = async (data: Partial<SurveyWithQuestions> & { isLive?: boolean }) => {
    try { await api.updateSurvey(surveyId, data); load(); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : "Failed", "err"); }
  };

  const toggleLive = () => {
    const goingLive = !(survey.isLive || survey.status === "live");
    patch({ isLive: goingLive, status: goingLive ? "live" : "paused" });
    toast.push(goingLive ? "Survey is live" : "Survey paused", "ok");
  };

  const duplicate = async () => {
    try { const s = await api.duplicateSurvey(surveyId); toast.push("Duplicated", "ok"); navigate(`/surveys/${s.id}`); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : "Failed", "err"); }
  };

  const moveQ = async (index: number, dir: -1 | 1) => {
    const next = [...survey.questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSurvey({ ...survey, questions: next });
    try { await api.reorderQuestions(surveyId, next.map((q) => q.id)); }
    catch { toast.push("Reorder failed", "err"); load(); }
  };

  const removeQ = async (id: string) => {
    try { await api.deleteQuestion(id); load(); } catch { toast.push("Delete failed", "err"); }
  };

  const isLive = survey.isLive || survey.status === "live";

  return (
    <div className="page">
      <div className="page-head row between">
        <div>
          <div className="row" style={crumbStyle}>
            {survey.eventId
              ? <Link to={`/events/${survey.eventId}`} className="small faint crumb-link"><IconArrowLeft size={14} /> Back to event</Link>
              : <Link to="/" className="small faint crumb-link"><IconArrowLeft size={14} /> Dashboard</Link>}
            <Badge tone={isLive ? "live" : "accent"} dot pulse={isLive}>{survey.status}</Badge>
            <span className="small faint">Join code {survey.joinCode}</span>
          </div>
          <SplitText text={survey.title} tag="h1" className="page-title" splitType="chars" delay={20} duration={0.35} fromY={12} />
        </div>
        <div className="row">
          <Button variant="ghost" onClick={duplicate}>Duplicate</Button>
          <Button variant="ghost" onClick={() => setSharing(true)}><IconShare size={15} /> Share</Button>
          <Button variant="ghost" onClick={() => navigate(`/present/${surveyId}`)}>Present</Button>
          <Button variant={isLive ? "danger" : "primary"} onClick={toggleLive}>{isLive ? "Pause" : "Go live"}</Button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "build" ? "active" : ""}`} onClick={() => setTab("build")}>Build</div>
        <div className={`tab ${tab === "preview" ? "active" : ""}`} onClick={() => setTab("preview")}>Preview</div>
        <div className={`tab ${tab === "results" ? "active" : ""}`} onClick={() => setTab("results")}>Results</div>
      </div>

      {tab === "build" && (
        <div className="stack">
          <SurveyMeta survey={survey} onSave={patch} />
          <div className="row between">
            <h3>Questions ({survey.questions.length})</h3>
            <Button variant="primary" onClick={() => setAdding(true)}>+ Add question</Button>
          </div>
          {survey.questions.length === 0 ? (
            <Card><Empty icon={<IconHelpCircle size={36} />} title="No questions yet">Add your first question to start collecting responses.</Empty></Card>
          ) : (
            <div className="stack">
              {survey.questions.map((q, i) => (
                <Card key={q.id}>
                  <div className="row between">
                    <div>
                      <span className="kind-chip">{QUESTION_TYPE_LABELS[q.type] || q.type}{q.required ? " \u00b7 required" : ""}</span>
                      <div className="tl-title">{i + 1}. {q.label}</div>
                      {NEEDS_OPTIONS.includes(q.type) && q.options.length > 0 && (
                        <p className="muted small" style={optsStyle}>{q.options.join(" \u00b7 ")}</p>
                      )}
                    </div>
                    <div className="row">
                      <Button size="sm" variant="ghost" onClick={() => moveQ(i, -1)} aria-label="Move up"><IconChevronUp size={15} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => moveQ(i, 1)} aria-label="Move down"><IconChevronDown size={15} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingQ(q)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => removeQ(q.id)} aria-label="Delete"><IconClose size={15} /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "preview" && <PreviewTab survey={survey} />}
      {tab === "results" && <ResultsTab surveyId={surveyId} />}

      {sharing && (
        <Modal title="Share this survey" onClose={() => setSharing(false)}>
          <SharePanel
            url={`${window.location.origin}/r/${surveyId}`}
            title={survey.title}
            caption="Scan or share this link — attendees respond instantly from their phones."
          />
        </Modal>
      )}
      {adding && <QuestionModal surveyId={surveyId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      {editingQ && <QuestionModal surveyId={surveyId} question={editingQ} onClose={() => setEditingQ(null)} onSaved={() => { setEditingQ(null); load(); }} />}
    </div>
  );
}

function SurveyMeta(props: { survey: SurveyWithQuestions; onSave: (d: Partial<SurveyWithQuestions>) => void }) {
  const { survey } = props;
  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description);
  const [audience, setAudience] = useState(survey.audience);
  const dirty = title !== survey.title || description !== survey.description || audience !== survey.audience;
  return (
    <Card>
      <div className="grid grid-2">
        <Field label="Survey title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Audience"><input className="input" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. All attendees" /></Field>
      </div>
      <Field label="Description"><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="row" style={metaFootStyle}>
        <Button variant="primary" disabled={!dirty} onClick={() => props.onSave({ title, description, audience })}>Save changes</Button>
        {dirty && <span className="hint">Unsaved changes</span>}
      </div>
    </Card>
  );
}

function PreviewTab(props: { survey: SurveyWithQuestions }) {
  const { survey } = props;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  return (
    <Card style={previewWrapStyle}>
      <Badge tone="accent">Preview \u00b7 not recorded</Badge>
      <h2 style={previewTitleStyle}>{survey.title}</h2>
      {survey.description && <p className="muted" style={previewDescStyle}>{survey.description}</p>}
      {survey.questions.map((q, i) => (
        <div key={q.id} style={previewQStyle}>
          <div className="q-label">{i + 1}. {q.label}{q.required && <span className="req-star">*</span>}</div>
          <QuestionInput question={q} value={answers[q.id] ?? null} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        </div>
      ))}
      {survey.questions.length === 0 && <Empty title="Nothing to preview">Add questions in the Build tab.</Empty>}
    </Card>
  );
}

function ResultsTab(props: { surveyId: string }) {
  const live = useLiveTally(props.surveyId, 5000);
  const submitted = useSurveyResponses(props.surveyId);
  const r = live.results;
  if (!r) return <Card><div className="center-screen"><Spinner /></div></Card>;
  if (r.totalResponses === 0) return <Card><Empty icon={<IconInbox size={36} />} title="No responses yet">Share the join code or QR to start collecting.</Empty></Card>;
  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatTile label="Responses" value={r.totalResponses} />
        <StatTile label="Completion" value={`${Math.round(r.completionRate * 100)}%`} />
        <StatTile label="Avg rating" value={r.averageRating != null ? r.averageRating.toFixed(2) : "\u2014"} />
        <StatTile label="NPS" value={r.npsScore != null ? r.npsScore : "\u2014"} tone={(r.npsScore ?? 0) >= 0 ? "good" : "bad"} />
      </div>
      {r.questions.map((q) => (
        <Card key={q.questionId}>
          <div className="row between" style={resQHeadStyle}>
            <h3>{q.label}</h3>
            <span className="small faint">{q.total} answers{q.average != null ? ` \u00b7 avg ${q.average.toFixed(2)}` : ""}</span>
          </div>
          {q.type === "text"
            ? <OpenTextResponses questionId={q.questionId} {...submitted} />
            : <BarChart buckets={q.buckets} />}
        </Card>
      ))}
    </div>
  );
}

function QuestionModal(props: { surveyId: string; question?: Question; onClose: () => void; onSaved: () => void }) {
  const { question } = props;
  const toast = useToast();
  const [label, setLabel] = useState(question?.label || "");
  const [type, setType] = useState<QuestionType>(question?.type || "single");
  const [required, setRequired] = useState(question?.required ?? false);
  const [optionsText, setOptionsText] = useState((question?.options || []).join("\n"));
  const [min, setMin] = useState(question?.config.min != null ? String(question.config.min) : "");
  const [max, setMax] = useState(question?.config.max != null ? String(question.config.max) : "");
  const [minLabel, setMinLabel] = useState(question?.config.minLabel || "");
  const [maxLabel, setMaxLabel] = useState(question?.config.maxLabel || "");

  const save = async () => {
    if (!label.trim()) { toast.push("Add a question label", "err"); return; }
    const options = NEEDS_OPTIONS.includes(type) ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean) : [];
    if (NEEDS_OPTIONS.includes(type) && options.length < 2) { toast.push("Add at least two options", "err"); return; }
    const config: Record<string, unknown> = {};
    if (min !== "") config.min = Number(min);
    if (max !== "") config.max = Number(max);
    if (minLabel) config.minLabel = minLabel;
    if (maxLabel) config.maxLabel = maxLabel;
    const payload = { label: label.trim(), type, required, options, config };
    try {
      if (question) await api.updateQuestion(question.id, payload);
      else await api.createQuestion(props.surveyId, payload);
      props.onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };

  return (
    <Modal title={question ? "Edit question" : "Add question"} onClose={props.onClose}
      footer={<><Button variant="ghost" onClick={props.onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <Field label="Question"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus /></Field>
      <div className="grid grid-2">
        <Field label="Type">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Required">
          <select className="select" value={required ? "yes" : "no"} onChange={(e) => setRequired(e.target.value === "yes")}>
            <option value="no">Optional</option><option value="yes">Required</option>
          </select>
        </Field>
      </div>
      {NEEDS_OPTIONS.includes(type) && (
        <Field label="Options" hint="One per line"><textarea className="textarea" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"Option A\nOption B\nOption C"} /></Field>
      )}
      {(type === "rating" || type === "scale" || type === "number") && (
        <div className="grid grid-2">
          <Field label="Min"><input className="input" type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder={type === "rating" ? "1" : ""} /></Field>
          <Field label="Max"><input className="input" type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder={type === "rating" ? "5" : ""} /></Field>
        </div>
      )}
      {type === "scale" && (
        <div className="grid grid-2">
          <Field label="Min label"><input className="input" value={minLabel} onChange={(e) => setMinLabel(e.target.value)} placeholder="Strongly disagree" /></Field>
          <Field label="Max label"><input className="input" value={maxLabel} onChange={(e) => setMaxLabel(e.target.value)} placeholder="Strongly agree" /></Field>
        </div>
      )}
    </Modal>
  );
}

const crumbStyle: CSSProperties = { gap: 12, marginBottom: 8 };
const optsStyle: CSSProperties = { marginTop: 6 };
const metaFootStyle: CSSProperties = { marginTop: 4, gap: 12 };
const previewWrapStyle: CSSProperties = { maxWidth: 620, margin: "0 auto" };
const previewTitleStyle: CSSProperties = { marginTop: 12 };
const previewDescStyle: CSSProperties = { marginTop: 6, marginBottom: 8 };
const previewQStyle: CSSProperties = { marginTop: 20 };
const resQHeadStyle: CSSProperties = { marginBottom: 14 };
