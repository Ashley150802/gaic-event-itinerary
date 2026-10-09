import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { EventDetail } from "../types";
import { Link, useRouter } from "../router";
import { Badge, Button, Card, Empty, Spinner } from "../components/ui";
import {
  IconArrowRightCircle, IconCalendar, IconCheckCircle, IconClock, IconCompass, IconMapPin,
} from "../components/icons";
import {
  clearAttendeeHistory, getAttendeeHistory, type AttendeeHistoryEntry,
} from "../lib/attendeeHistory";

type AttendeeEvent = EventDetail;

export function AttendeeDashboard() {
  const { navigate } = useRouter();
  const [events, setEvents] = useState<AttendeeEvent[]>([]);
  const [history, setHistory] = useState<AttendeeHistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const allEvents = await api.listEvents();
        const publicEvents = allEvents.filter((event) => event.status === "live" || event.status === "archived");
        const details = await Promise.all(publicEvents.map((event) => api.getEvent(event.id)));
        if (active) {
          setEvents(details);
          setError(null);
          try {
            setHistory(getAttendeeHistory());
            setHistoryError(null);
          } catch {
            setHistoryError("Could not read saved history in this browser. Clear it to start a fresh list.");
          }
        }
      } catch (e) {
        if (!active) return;
        setError(e instanceof ApiError ? e.message : "Could not load events. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const matchingEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter(({ event }) =>
      [event.title, event.description, event.location, event.organizer].some((value) => value.toLowerCase().includes(query))
    );
  }, [events, search]);
  const liveEvents = matchingEvents.filter(({ event }) => event.status === "live");
  const pastEvents = matchingEvents.filter(({ event }) => event.status === "archived");
  const eventNames = new Map(events.map(({ event }) => [event.id, event.title]));

  const forgetHistory = () => {
    if (!window.confirm("Clear saved survey responses from this browser? This cannot be undone.")) return;
    try {
      clearAttendeeHistory();
      setHistory([]);
      setHistoryError(null);
    } catch {
      setHistoryError("Could not clear saved history from this browser.");
    }
  };

  return (
    <div className="attendee-portal">
      <header className="attendee-topbar">
        <Link to="/attendee" className="attendee-brand">
          <img src="/GAIC logo Color.png" alt="GAIC" />
        </Link>
        <Link to="/" className="attendee-operator-link">Operator dashboard</Link>
      </header>

      <main className="attendee-main">
        <section className="attendee-hero">
          <div className="eyebrow">Your community, in one place</div>
          <h1>Find your next event.</h1>
          <p className="muted">Explore what’s happening, open an event programme, and take part in live surveys.</p>
          <div className="attendee-privacy"><IconCheckCircle size={16} /> No account needed. Your response history stays in this browser.</div>
          <Button variant="primary" size="lg" onClick={() => navigate("/attendee/join")}>
            Join a survey <IconArrowRightCircle size={17} />
          </Button>
        </section>

        <div className="attendee-summary">
          <div><strong>{events.filter(({ event }) => event.status === "live").length}</strong><span>Live events</span></div>
          <div><strong>{events.filter(({ event }) => event.status === "archived").length}</strong><span>Past events</span></div>
          <div><strong>{history.length}</strong><span>Your responses</span></div>
        </div>

        <label className="attendee-search">
          <span>Search events</span>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Event name, location, or topic" />
        </label>

        {loading && <div className="center-screen"><Spinner /></div>}
        {error && <Card><p className="error-text">{error}</p></Card>}
        {!loading && !error && (
          <>
            <EventSection
              title="Live events"
              subtitle="Jump into a programme or answer a survey that’s open now."
              events={liveEvents}
              empty="There are no live events right now. Check back soon for the next community gathering."
              onSurvey={(id) => navigate(`/r/${id}`)}
            />
            <EventSection
              title="Past events"
              subtitle="Revisit completed programmes and the event details."
              events={pastEvents}
              empty="Completed events will appear here after they’re archived."
              onSurvey={(id) => navigate(`/r/${id}`)}
            />
            {liveEvents.length + pastEvents.length === 0 && events.length > 0 && (
              <Card><Empty icon={<IconCompass size={32} />} title="No matching events">Try another search, or clear the search field.</Empty></Card>
            )}

            <section className="attendee-history">
              <div className="attendee-section-head">
                <div>
                  <div className="eyebrow">Saved on this device</div>
                  <h2>Your survey responses</h2>
                  <p className="muted small">Stored in this browser only; anyone using this browser can view it.</p>
                </div>
                {history.length > 0 && <Button size="sm" variant="ghost" onClick={forgetHistory}>Clear history</Button>}
              </div>
              {historyError && <Card><div className="row between"><p className="error-text">{historyError}</p><Button size="sm" variant="ghost" onClick={forgetHistory}>Clear saved history</Button></div></Card>}
              {!historyError && history.length === 0 && (
                <Card><Empty icon={<IconCheckCircle size={32} />} title="Your history starts here">After you submit a survey, you can return here to review your answers.</Empty></Card>
              )}
              {!historyError && history.length > 0 && (
                <div className="attendee-history-list">
                  {history.map((entry) => (
                    <HistoryCard key={entry.responseId} entry={entry} eventTitle={entry.eventId ? eventNames.get(entry.eventId) : undefined} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="attendee-footer">Powered by GAIC</footer>
    </div>
  );
}

function EventSection(props: {
  title: string;
  subtitle: string;
  events: AttendeeEvent[];
  empty: string;
  onSurvey: (surveyId: string) => void;
}) {
  return (
    <section className="attendee-event-section">
      <div className="attendee-section-head">
        <div><h2>{props.title}</h2><p className="muted small">{props.subtitle}</p></div>
      </div>
      {props.events.length === 0
        ? <Card><Empty icon={<IconCalendar size={30} />} title={props.title === "Live events" ? "Nothing live at the moment" : "No past events yet"}>{props.empty}</Empty></Card>
        : <div className="attendee-event-grid">{props.events.map((detail) => (
          <EventCard key={detail.event.id} detail={detail} onSurvey={props.onSurvey} />
        ))}</div>}
    </section>
  );
}

function EventCard({ detail, onSurvey }: { detail: AttendeeEvent; onSurvey: (surveyId: string) => void }) {
  const { event, segments, surveys } = detail;
  const completed = event.status === "archived";
  const openSurveys = completed ? [] : surveys.filter((survey) => survey.status === "live" || survey.isLive);
  return (
    <Card className={`attendee-event-card theme-${event.theme}`}>
      <div className="row between">
        <Badge tone={completed ? "default" : "live"} dot pulse={!completed}>{completed ? "Completed" : "Live now"}</Badge>
        {event.startsAt && <span className="small faint">{new Date(event.startsAt).toLocaleDateString()}</span>}
      </div>
      <h3>{event.title}</h3>
      {event.description && <p className="muted small">{event.description}</p>}
      <div className="attendee-event-meta">
        {event.location && <span><IconMapPin size={14} /> {event.location}</span>}
        <span><IconClock size={14} /> {segments.length} programme items</span>
      </div>
      <div className="attendee-event-actions">
        <Link className="btn btn-ghost btn-sm" to={`/e/${event.slug}`}><IconCalendar size={14} /> View programme</Link>
        {openSurveys.map((survey) => (
          <Button key={survey.id} variant="primary" size="sm" onClick={() => onSurvey(survey.id)}>
            <IconArrowRightCircle size={14} /> {survey.title}
          </Button>
        ))}
      </div>
      {!completed && openSurveys.length === 0 && <p className="attendee-no-survey">No surveys are open right now.</p>}
    </Card>
  );
}

function HistoryCard({ entry, eventTitle }: { entry: AttendeeHistoryEntry; eventTitle?: string }) {
  return (
    <Card className="attendee-history-card">
      <div className="row between">
        <div>
          <div className="eyebrow">{eventTitle || "Community event"}</div>
          <h3>{entry.surveyTitle}</h3>
        </div>
        <time className="small muted" dateTime={entry.submittedAt}>{new Date(entry.submittedAt).toLocaleString()}</time>
      </div>
      <details>
        <summary>Review your answers</summary>
        <div className="attendee-answer-list">
          {entry.answers.length === 0 && <p className="muted small">No question answers were submitted.</p>}
          {entry.answers.map((answer, index) => (
            <div key={`${entry.responseId}-${index}`}>
              <strong>{answer.label}</strong>
              <span>{Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value)}</span>
            </div>
          ))}
          {entry.note && <div><strong>Additional comment</strong><span>{entry.note}</span></div>}
        </div>
      </details>
    </Card>
  );
}
