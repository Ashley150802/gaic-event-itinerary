// Dashboard: overview of all events with quick create + template entry points.

import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { EventRecord, TemplateSummary } from "../types";
import { Link, useRouter } from "../router";
import { Button, Card, Badge, Spinner, Empty, Modal, Field, useToast } from "../components/ui";
import { IconCalendar } from "../components/icons";
import { useSettings, THEMES } from "../lib/settings";
import { Counter } from "../components/reactbits/Counter";
import { SplitText } from "../components/reactbits/SplitText";

export function Dashboard() {
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      setError(null);
      const data = await api.listEvents();
      setEvents(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load events");
      setEvents([]);
    }
  };
  useEffect(() => { load(); }, []);

  const liveCount = (events || []).filter((e) => e.status === "live").length;

  return (
    <div className="page">
      <div className="page-head row between">
        <div>
          <div className="eyebrow">Workspace</div>
          <SplitText text="Your events" tag="h1" className="page-title" splitType="chars" delay={30} duration={0.4} fromY={20} />
          <p className="page-sub">Plan an itinerary, publish surveys, and tally responses live with your audience.</p>
        </div>
        <div className="row">
          <Link to="/templates"><Button variant="ghost">Browse templates</Button></Link>
          <Button variant="primary" onClick={() => setCreating(true)}>+ New event</Button>
        </div>
      </div>

      {events && events.length > 0 && (
        <div className="grid grid-3" style={statRowStyle}>
          <Card className="stat"><div className="stat-label">Events</div><div className="stat-value"><Counter value={events.length} fontSize={32} gap={2} textColor="var(--text)" fontWeight={700} duration={600} /></div></Card>
          <Card className="stat"><div className="stat-label">Live now</div><div className="stat-value"><Counter value={liveCount} fontSize={32} gap={2} textColor="var(--bad)" fontWeight={700} duration={800} /></div></Card>
          <Card className="stat"><div className="stat-label">Drafts</div><div className="stat-value"><Counter value={events.filter((e) => e.status === "draft").length} fontSize={32} gap={2} textColor="var(--text-muted)" fontWeight={700} duration={700} /></div></Card>
        </div>
      )}

      {error && <Card style={errStyle}><span className="error-text">{error}</span></Card>}

      {events === null && <div className="center-screen"><Spinner /></div>}

      {events && events.length === 0 && !error && (
        <Card>
          <Empty icon={<IconCalendar size={36} />} title="No events yet">
            Create your first event or start from a ready-made template like an AI meetup.
          </Empty>
          <div className="row" style={emptyActionsStyle}>
            <Button variant="primary" onClick={() => setCreating(true)}>+ New event</Button>
            <Link to="/templates"><Button variant="ghost">Use a template</Button></Link>
          </div>
        </Card>
      )}

      {events && events.length > 0 && (
        <div className="grid grid-3">
          {events.map((ev) => <EventCard key={ev.id} event={ev} />)}
        </div>
      )}

      {creating && <CreateEventModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); toast.push("Event created", "ok"); }} />}
    </div>
  );
}

function EventCard(props: { event: EventRecord }) {
  const { event } = props;
  const { navigate } = useRouter();
  return (
    <Card className={`theme-${event.theme}`}>
      <div className="row between">
        <Badge tone={event.status === "live" ? "live" : event.status === "archived" ? "default" : "accent"} dot pulse={event.status === "live"}>
          {event.status}
        </Badge>
        <span className="small faint">{event.startsAt ? new Date(event.startsAt).toLocaleDateString() : "No date"}</span>
      </div>
      <h3 style={cardTitleStyle}>{event.title}</h3>
      <p className="muted small" style={cardDescStyle}>{event.description || "No description yet."}</p>
      <div className="row between" style={cardFootStyle}>
        <span className="small faint">{event.location || event.organizer || "\u2014"}</span>
        <Button size="sm" onClick={() => navigate(`/events/${event.id}`)}>Open</Button>
      </div>
    </Card>
  );
}

function CreateEventModal(props: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const { navigate } = useRouter();
  const { settings } = useSettings();
  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState(settings.defaultOrganizer);
  const [location, setLocation] = useState(settings.defaultLocation);
  const [theme, setTheme] = useState<string>(settings.theme);
  const [templateId, setTemplateId] = useState<string>(settings.defaultTemplateId);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.templates().then((c) => setTemplates(c.events)).catch(() => {}); }, []);

  const submit = async () => {
    if (!title.trim()) { toast.push("Give your event a title", "err"); return; }
    setBusy(true);
    try {
      let ev: EventRecord;
      if (templateId) {
        ev = await api.applyEventTemplate(templateId);
        await api.updateEvent(ev.id, { title: title.trim(), organizer: organizer.trim(), location: location.trim(), theme });
      } else {
        ev = await api.createEvent({ title: title.trim(), organizer: organizer.trim(), location: location.trim(), theme });
      }
      props.onClose();
      navigate(`/events/${ev.id}`);
      toast.push(templateId ? "Event created from template" : "Event created", "ok");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed to create", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Create event"
      onClose={props.onClose}
      footer={<><Button variant="ghost" onClick={props.onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={busy}>{busy ? "Creating\u2026" : "Create"}</Button></>}
    >
      <Field label="Event title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Founders & Builders AI Meetup" autoFocus /></Field>
      <Field label="Starting template" hint="Pre-filled with your default from Settings.">
        <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Blank event (no template)</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Organizer"><input className="input" value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="GAIC" /></Field>
      <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cape Town" /></Field>
      <Field label="Theme">
        <select className="select" value={theme} onChange={(e) => setTheme(e.target.value)}>
          {THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </Field>
    </Modal>
  );
}

import type { CSSProperties } from "react";
const statRowStyle: CSSProperties = { marginBottom: 22 };
const errStyle: CSSProperties = { marginBottom: 16, borderColor: "var(--bad)" };
const emptyActionsStyle: CSSProperties = { justifyContent: "center", marginTop: 4 };
const cardTitleStyle: CSSProperties = { marginTop: 12, fontSize: 17 };
const cardDescStyle: CSSProperties = { marginTop: 6, minHeight: 38 };
const cardFootStyle: CSSProperties = { marginTop: 14 };
