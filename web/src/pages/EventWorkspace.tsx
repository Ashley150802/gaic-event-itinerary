// Event workspace with tabs: Overview, Itinerary, Surveys, Analytics.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { EventDetail, Segment, Survey } from "../types";
import { Link, useRouter } from "../router";
import { Button, Card, Badge, Spinner, Empty, Modal, Field, useToast, SEGMENT_KIND_LABELS } from "../components/ui";
import { useLiveTally } from "../hooks/useLiveTally";
import { StatTile, Sparkline, Donut } from "../components/charts";
import { SharePanel } from "../components/Share";
import { IconArrowLeft, IconChevronUp, IconChevronDown, IconClose, IconShare, IconMic, IconMapPin, IconCalendarClock, IconChart, IconTrash } from "../components/icons";
import { exportResultsCsv, exportResultsJson } from "../lib/export";
import { formatInZone, detectTimezone } from "../lib/timezone";
import { SplitText } from "../components/reactbits/SplitText";

type Tab = "overview" | "itinerary" | "surveys" | "analytics";

export function EventWorkspace(props: { eventId: string }) {
  const { eventId } = props;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [sharing, setSharing] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const d = await api.getEvent(eventId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load event");
    }
  };
  useEffect(() => { load(); }, [eventId]);

  if (error) return <div className="page"><Card><p className="error-text">{error}</p></Card></div>;
  if (!detail) return <div className="page"><div className="center-screen"><Spinner /></div></div>;

  const { event, segments, surveys } = detail;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "itinerary", label: `Itinerary (${segments.length})` },
    { id: "surveys", label: `Surveys (${surveys.length})` },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className={`page theme-${event.theme}`}>
      <div className="page-head row between">
        <div>
          <div className="row" style={crumbStyle}>
            <Link to="/" className="small faint crumb-link"><IconArrowLeft size={14} /> All events</Link>
            <Badge tone={event.status === "live" ? "live" : "accent"} dot pulse={event.status === "live"}>{event.status}</Badge>
          </div>
          <SplitText text={event.title} tag="h1" className="page-title" splitType="chars" delay={20} duration={0.35} fromY={12} />
          <p className="page-sub">{[event.organizer, event.location, event.startsAt ? formatInZone(event.startsAt, detectTimezone()) : null].filter(Boolean).join(" \u00b7 ") || "Add details in Overview"}</p>
        </div>
        <div className="row">
          <Button variant="ghost" onClick={() => setSharing(true)}><IconShare size={15} /> Share itinerary</Button>
          <EventStatusControl detail={detail} onChange={load} />
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {tab === "overview" && <OverviewTab detail={detail} onChange={load} />}
      {tab === "itinerary" && <ItineraryTab detail={detail} onChange={load} />}
      {tab === "surveys" && <SurveysTab detail={detail} onChange={load} />}
      {tab === "analytics" && <AnalyticsTab detail={detail} />}

      {sharing && (
        <Modal title="Share event itinerary" onClose={() => setSharing(false)}>
          <SharePanel
            url={`${window.location.origin}/e/${event.slug}`}
            title={event.title}
            caption="Attendees scan this to open the live day itinerary on their phones — no login needed."
          />
        </Modal>
      )}
    </div>
  );
}

function EventStatusControl(props: { detail: EventDetail; onChange: () => void }) {
  const { detail } = props;
  const toast = useToast();
  const cycle = async () => {
    const next = detail.event.status === "draft" ? "live" : detail.event.status === "live" ? "archived" : "draft";
    try {
      await api.updateEvent(detail.event.id, { status: next });
      toast.push(`Event ${next}`, "ok");
      props.onChange();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };
  return (
    <div className="row">
      <Button onClick={cycle}>{detail.event.status === "draft" ? "Go live" : detail.event.status === "live" ? "Archive" : "Reopen"}</Button>
    </div>
  );
}

function OverviewTab(props: { detail: EventDetail; onChange: () => void }) {
  const { detail } = props;
  const { event, segments, surveys } = detail;
  const liveSurveys = surveys.filter((s) => s.isLive || s.status === "live").length;
  const [editing, setEditing] = useState(false);
  return (
    <div className="stack">
      <div className="grid grid-4">
        <StatTile label="Agenda items" value={segments.length} />
        <StatTile label="Surveys" value={surveys.length} />
        <StatTile label="Live surveys" value={liveSurveys} tone={liveSurveys > 0 ? "good" : "muted"} />
        <StatTile label="Theme" value={event.theme} />
      </div>
      <Card>
        <div className="row between">
          <h3>About this event</h3>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit details</Button>
        </div>
        <p className="muted" style={aboutStyle}>{event.description || "No description yet. Add one so attendees know what to expect."}</p>
      </Card>
      <DangerZone detail={detail} onChange={props.onChange} />
      {editing && <EditEventModal detail={detail} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); props.onChange(); }} />}
    </div>
  );
}

function DangerZone(props: { detail: EventDetail; onChange: () => void }) {
  const { event } = props.detail;
  const toast = useToast();
  const { navigate } = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const setStatus = async (status: "archived" | "draft") => {
    try {
      await api.updateEvent(event.id, { status });
      toast.push(status === "archived" ? "Event archived" : "Event reset to draft", "ok");
      props.onChange();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };
  const del = async () => {
    try { await api.deleteEvent(event.id); toast.push("Event deleted", "ok"); navigate("/"); }
    catch (e) { toast.push(e instanceof ApiError ? e.message : "Failed", "err"); }
  };

  return (
    <Card className="danger-zone">
      <h3 className="danger-title">Danger zone</h3>
      <div className="danger-row">
        <div><div className="set-row-label">{event.status === "archived" ? "Reopen event" : "Archive event"}</div><div className="muted small">Archived events are hidden from the live dashboard but keep all data.</div></div>
        {event.status === "archived"
          ? <Button variant="ghost" onClick={() => setStatus("draft")}>Reopen as draft</Button>
          : <Button variant="ghost" onClick={() => setStatus("archived")}>Archive</Button>}
      </div>
      <div className="danger-row">
        <div><div className="set-row-label">Reset to draft</div><div className="muted small">Take the event offline and return it to draft status.</div></div>
        <Button variant="ghost" disabled={event.status === "draft"} onClick={() => setStatus("draft")}>Reset</Button>
      </div>
      <div className="danger-row">
        <div><div className="set-row-label">Delete event</div><div className="muted small">Permanently removes this event, its itinerary, and surveys.</div></div>
        <Button variant="danger" onClick={() => { setConfirming(true); setConfirmText(""); }}><IconTrash size={15} /> Delete</Button>
      </div>
      {confirming && (
        <Modal title="Delete this event?" onClose={() => setConfirming(false)}
          footer={<><Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button><Button variant="danger" disabled={confirmText.trim().toUpperCase() !== "DELETE"} onClick={del}>Delete forever</Button></>}>
          <p className="muted small">This cannot be undone. Type <strong>DELETE</strong> to confirm removal of <strong>{event.title}</strong> and all of its surveys and responses.</p>
          <div style={dzSpacerStyle} />
          <Field label="Type DELETE to confirm"><input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" autoFocus /></Field>
        </Modal>
      )}
    </Card>
  );
}

function EditEventModal(props: { detail: EventDetail; onClose: () => void; onSaved: () => void }) {
  const { event } = props.detail;
  const toast = useToast();
  const [form, setForm] = useState({
    title: event.title, description: event.description, organizer: event.organizer,
    location: event.location, theme: event.theme, startsAt: event.startsAt ? event.startsAt.slice(0, 16) : "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    try {
      await api.updateEvent(event.id, {
        title: form.title, description: form.description, organizer: form.organizer,
        location: form.location, theme: form.theme,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      });
      props.onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };
  return (
    <Modal title="Edit event" onClose={props.onClose}
      footer={<><Button variant="ghost" onClick={props.onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <Field label="Title"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <div className="grid grid-2">
        <Field label="Organizer"><input className="input" value={form.organizer} onChange={(e) => set("organizer", e.target.value)} /></Field>
        <Field label="Location"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
      </div>
      <div className="grid grid-2">
        <Field label="Starts at"><input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
        <Field label="Theme">
          <select className="select" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
            <option value="aurora">Aurora</option><option value="ember">Ember</option><option value="forest">Forest</option><option value="violet">Violet</option><option value="rose">Rose</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function fmtTime(iso: string | null): string {
  return formatInZone(iso, detectTimezone(), { hour: "2-digit", minute: "2-digit" });
}

function ItineraryTab(props: { detail: EventDetail; onChange: () => void }) {
  const { detail } = props;
  const { segments } = detail;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const toast = useToast();

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...segments];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.reorderSegments(detail.event.id, next.map((s) => s.id));
      props.onChange();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };

  const remove = async (id: string) => {
    try { await api.deleteSegment(id); props.onChange(); } catch { toast.push("Failed to delete", "err"); }
  };

  return (
    <div className="stack">
      <div className="row between">
        <p className="muted small">Build the day. Reorder items, attach surveys to sessions, and attendees follow along live.</p>
        <Button variant="primary" onClick={() => setAdding(true)}>+ Add item</Button>
      </div>
      {segments.length === 0 ? (
        <Card><Empty icon={<IconCalendarClock size={36} />} title="No agenda items">Add keynotes, sessions, breaks, and survey moments.</Empty></Card>
      ) : (
        <Card>
          <div className="timeline">
            {segments.map((s, i) => (
              <div key={s.id} className={`tl-item kind-${s.kind}`}>
                <div className="tl-time">{fmtTime(s.startsAt) || "\u2014"}{s.endsAt ? ` \u2013 ${fmtTime(s.endsAt)}` : ""}</div>
                <div className="tl-body">
                  <div className="row between">
                    <div>
                      <span className="kind-chip">{SEGMENT_KIND_LABELS[s.kind] || s.kind}</span>
                      <div className="tl-title">{s.title}</div>
                    </div>
                    <div className="row">
                      <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up"><IconChevronUp size={15} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down"><IconChevronDown size={15} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(s.id)} aria-label="Delete"><IconClose size={15} /></Button>
                    </div>
                  </div>
                  {(s.speaker || s.location || s.description) && (
                    <div className="tl-meta">
                      {s.speaker && <span className="meta-ico"><IconMic size={14} /> {s.speaker}</span>}
                      {s.location && <span className="meta-ico"><IconMapPin size={14} /> {s.location}</span>}
                      {s.surveyId && <span><Link to={`/surveys/${s.surveyId}`} className="badge-accent">Linked survey</Link></span>}
                    </div>
                  )}
                  {s.description && <p className="muted small" style={segDescStyle}>{s.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {adding && <SegmentModal eventId={detail.event.id} surveys={detail.surveys} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); props.onChange(); }} />}
      {editing && <SegmentModal eventId={detail.event.id} surveys={detail.surveys} segment={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); props.onChange(); }} />}
    </div>
  );
}

function SegmentModal(props: { eventId: string; surveys: Survey[]; segment?: Segment; onClose: () => void; onSaved: () => void }) {
  const { segment, surveys } = props;
  const toast = useToast();
  const [form, setForm] = useState({
    title: segment?.title || "", kind: segment?.kind || "session", speaker: segment?.speaker || "",
    location: segment?.location || "", description: segment?.description || "",
    startsAt: segment?.startsAt ? segment.startsAt.slice(0, 16) : "", endsAt: segment?.endsAt ? segment.endsAt.slice(0, 16) : "",
    surveyId: segment?.surveyId || "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.title.trim()) { toast.push("Add a title", "err"); return; }
    const payload = {
      title: form.title.trim(), kind: form.kind as Segment["kind"], speaker: form.speaker, location: form.location,
      description: form.description, surveyId: form.surveyId || null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      if (segment) await api.updateSegment(segment.id, payload);
      else await api.createSegment(props.eventId, payload);
      props.onSaved();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };
  return (
    <Modal title={segment ? "Edit agenda item" : "Add agenda item"} onClose={props.onClose}
      footer={<><Button variant="ghost" onClick={props.onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <Field label="Title"><input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Field>
      <div className="grid grid-2">
        <Field label="Type">
          <select className="select" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {Object.entries(SEGMENT_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Speaker"><input className="input" value={form.speaker} onChange={(e) => set("speaker", e.target.value)} /></Field>
      </div>
      <div className="grid grid-2">
        <Field label="Starts"><input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
        <Field label="Ends"><input className="input" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Field>
      </div>
      <Field label="Location"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label="Link a survey (optional)">
        <select className="select" value={form.surveyId} onChange={(e) => set("surveyId", e.target.value)}>
          <option value="">None</option>
          {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

function SurveysTab(props: { detail: EventDetail; onChange: () => void }) {
  const { detail } = props;
  const { navigate } = useRouter();
  const toast = useToast();
  const create = async () => {
    try {
      const s = await api.createSurvey({ eventId: detail.event.id, title: "Untitled survey", mode: "live" });
      navigate(`/surveys/${s.id}`);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    }
  };
  return (
    <div className="stack">
      <div className="row between">
        <p className="muted small">Publish surveys for this event. Live surveys tally on the big screen in real time.</p>
        <Button variant="primary" onClick={create}>+ New survey</Button>
      </div>
      {detail.surveys.length === 0 ? (
        <Card><Empty icon={<IconChart size={36} />} title="No surveys yet">Create a live poll, feedback form, or NPS pulse.</Empty></Card>
      ) : (
        <div className="grid grid-2">
          {detail.surveys.map((s) => <SurveyRow key={s.id} survey={s} onChange={props.onChange} />)}
        </div>
      )}
    </div>
  );
}

function SurveyRow(props: { survey: Survey; onChange: () => void }) {
  const { survey } = props;
  const { navigate } = useRouter();
  const live = useLiveTally(survey.isLive ? survey.id : null, 5000);
  return (
    <Card>
      <div className="row between">
        <Badge tone={survey.status === "live" ? "live" : survey.status === "closed" ? "default" : "accent"} dot pulse={survey.status === "live"}>{survey.status}</Badge>
        <span className="small faint">Code {survey.joinCode}</span>
      </div>
      <h3 style={srvTitleStyle}>{survey.title}</h3>
      <p className="muted small" style={srvDescStyle}>{survey.description || "No description"}</p>
      <div className="row between" style={srvFootStyle}>
        <span className="small muted">{live.results?.totalResponses ?? 0} responses</span>
        <div className="row">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/present/${survey.id}`)}>Present</Button>
          <Button size="sm" onClick={() => navigate(`/surveys/${survey.id}`)}>Open</Button>
        </div>
      </div>
    </Card>
  );
}

function AnalyticsTab(props: { detail: EventDetail }) {
  const { detail } = props;
  const surveys = detail.surveys;
  const [surveyId, setSurveyId] = useState<string | null>(surveys[0]?.id ?? null);
  const live = useLiveTally(surveyId, 6000);
  if (surveys.length === 0) return <Card><Empty title="No data yet">Create a survey and collect responses to see analytics.</Empty></Card>;
  const r = live.results;
  const curTitle = surveys.find((s) => s.id === surveyId)?.title || "survey";
  return (
    <div className="stack">
      <div className="row between">
        <Field label="Survey">
          <select className="select" value={surveyId ?? ""} onChange={(e) => setSurveyId(e.target.value)}>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </Field>
        <div className="row">
          <Button size="sm" variant="ghost" disabled={!r} onClick={() => { if (r) exportResultsCsv(curTitle, r); }}>Export CSV</Button>
          <Button size="sm" variant="ghost" disabled={!r} onClick={() => { if (r) exportResultsJson(curTitle, r); }}>Export JSON</Button>
          <Badge tone={live.connected ? "live" : "default"} dot pulse={live.connected}>{live.connected ? "Live" : "Auto-refresh"}</Badge>
        </div>
      </div>
      <div className="grid grid-4">
        <StatTile label="Responses" value={r?.totalResponses ?? 0} />
        <StatTile label="Completion" value={`${Math.round((r?.completionRate ?? 0) * 100)}%`} />
        <StatTile label="Avg rating" value={r?.averageRating != null ? r.averageRating.toFixed(2) : "\u2014"} />
        <StatTile label="NPS" value={r?.npsScore != null ? r.npsScore : "\u2014"} tone={(r?.npsScore ?? 0) >= 0 ? "good" : "bad"} />
      </div>
      <div className="grid grid-2">
        <Card><h3 style={blockTitleStyle}>Responses over time</h3>{r && r.daily.length > 0 ? <Sparkline points={r.daily.map((d) => ({ label: d.label, value: d.value }))} /> : <p className="faint small">No data yet.</p>}</Card>
        <Card><h3 style={blockTitleStyle}>Sentiment</h3>{r ? <Donut data={[{ label: "Positive", value: r.sentiment.positive }, { label: "Neutral", value: r.sentiment.neutral }, { label: "Negative", value: r.sentiment.negative }]} /> : null}</Card>
      </div>
      {r && r.keywords.length > 0 && (
        <Card><h3 style={blockTitleStyle}>Top keywords</h3>
          <div className="chips">{r.keywords.map((k) => <span className="chip" key={k.word}><strong>{k.word}</strong> {k.count}</span>)}</div>
        </Card>
      )}
    </div>
  );
}

const crumbStyle: CSSProperties = { gap: 12, marginBottom: 8 };
const aboutStyle: CSSProperties = { marginTop: 12 };
const segDescStyle: CSSProperties = { marginTop: 8 };
const srvTitleStyle: CSSProperties = { marginTop: 12, fontSize: 16 };
const srvDescStyle: CSSProperties = { marginTop: 6, minHeight: 34 };
const srvFootStyle: CSSProperties = { marginTop: 12 };
const blockTitleStyle: CSSProperties = { marginBottom: 14 };
const dzSpacerStyle: CSSProperties = { height: 12 };
