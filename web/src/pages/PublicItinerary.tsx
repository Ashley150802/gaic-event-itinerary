// Public, mobile-first event itinerary for attendees.
//
// This is what a day-attendee sees when a speaker shares the event link (or QR).
// It is intentionally a full-screen, no-shell, read-only experience tuned for
// phones: a sticky event header, a "happening now / up next" highlight derived
// from segment times, a vivid vertical timeline with per-kind icons, and
// one-tap "Rate this" / "Rate the day" actions that deep-link to the relevant
// live survey. No admin controls, no auth, minimal payload -> safe for 100-200
// concurrent attendees.

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { EventDetail, Segment, Survey } from "../types";
import { useRouter } from "../router";
import { Spinner } from "../components/ui";
import { useReveal } from "../lib/motion";
import { pressRipple } from "../lib/motion";
import { formatTimeInZone, formatDateInZone, detectTimezone } from "../lib/timezone";
import { ColorBends } from "../components/reactbits/ColorBends";
import { SplitText } from "../components/reactbits/SplitText";
import {
  SegmentIcon, LiveDot, IconCalendar, IconClock, IconMapPin, IconMic,
  IconArrowRightCircle, IconChart, IconCompass, IconUsers,
} from "../components/icons";

const SEGMENT_KIND_LABELS: Record<string, string> = {
  keynote: "Keynote", session: "Session", workshop: "Workshop", panel: "Panel",
  break: "Break", networking: "Networking", survey: "Survey",
};

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function formatTimeTz(value: string | null, tz: string): string {
  return formatTimeInZone(value, tz);
}

function formatDayTz(value: string | null, tz: string): string {
  return formatDateInZone(value, tz);
}

/** Figure out which segment is happening now, and which is next. */
function useTimeline(segments: Segment[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    let current: Segment | null = null;
    let next: Segment | null = null;
    for (const s of segments) {
      const start = parseTime(s.startsAt);
      const end = parseTime(s.endsAt);
      if (start !== null && end !== null && now >= start && now < end) current = s;
      if (start !== null && start > now && (next === null || start < (parseTime(next.startsAt) as number))) next = s;
    }
    return { current, next };
  }, [segments, now]);
}

export function PublicItinerary({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.className = "public-body";
    return () => { document.body.className = ""; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getEventBySlug(slug)
      .then((d) => { if (active) { setDetail(d); setError(null); } })
      .catch((e) => { if (active) setError(e instanceof ApiError ? e.message : "Could not load this event"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <div className="itin-screen center-screen"><Spinner /></div>;
  }
  if (error || !detail) {
    return (
      <div className="itin-screen center-screen">
        <div className="empty">
          <div className="empty-icon"><IconCompass size={40} /></div>
          <h3>Event unavailable</h3>
          <p className="muted">{error || "This itinerary may have been moved."}</p>
        </div>
      </div>
    );
  }

  const { event, segments, surveys } = detail;
  const liveSurveys = surveys.filter((s) => s.status === "live" || s.isLive);
  const ordered = [...segments].sort((a, b) => a.position - b.position);

  return (
    <div className="itin-screen">
      <ColorBends colors={["#5227FF", "#FF9FFC", "#7cff67"]} opacity={0.1} />
      <ItineraryHeader event={event} segmentCount={ordered.length} />
      <main className="itin-main">
        <NowNext segments={ordered} surveys={surveys} onRate={(id) => navigate(`/r/${id}`)} />
        {liveSurveys.length > 0 && (
          <RateTheDay surveys={liveSurveys} onRate={(id) => navigate(`/r/${id}`)} />
        )}
        <section className="itin-section">
          <h2 className="itin-section-title"><IconCalendar size={18} /> Full schedule</h2>
          {ordered.length === 0 ? (
            <p className="muted">The schedule will appear here once the organizer publishes it.</p>
          ) : (
            <ol className="timeline">
              {ordered.map((seg, i) => (
                <TimelineItem key={seg.id} seg={seg} index={i} onRate={(id) => navigate(`/r/${id}`)} />
              ))}
            </ol>
          )}
        </section>
        <footer className="itin-footer">
          <span>Surket</span>
          <span className="muted">Powered by Lehro Solutions</span>
        </footer>
      </main>
    </div>
  );
}

function ItineraryHeader({ event, segmentCount }: { event: EventDetail["event"]; segmentCount: number }) {
  const tz = detectTimezone();
  const day = formatDayTz(event.startsAt, tz);
  return (
    <header className={`itin-header theme-${event.theme || "aurora"}`}>
      <div className="itin-header-inner">
        {event.status === "live" && (
          <span className="itin-live"><LiveDot /> Live now</span>
        )}
        <h1 className="itin-title"><SplitText text={event.title} tag="span" splitType="chars" delay={20} duration={0.35} fromY={12} /></h1>
        {event.description && <p className="itin-desc">{event.description}</p>}
        <div className="itin-meta">
          {event.organizer && <span><IconUsers size={15} /> {event.organizer}</span>}
          {day && <span><IconCalendar size={15} /> {day}</span>}
          {event.location && <span><IconMapPin size={15} /> {event.location}</span>}
          <span><IconClock size={15} /> {segmentCount} sessions</span>
        </div>
      </div>
    </header>
  );
}

function NowNext({ segments, surveys, onRate }: { segments: Segment[]; surveys: Survey[]; onRate: (id: string) => void }) {
  const { current, next } = useTimeline(segments);
  const ref = useReveal(0);
  if (!current && !next) return null;
  const surveyFor = (seg: Segment | null) => (seg && seg.surveyId ? surveys.find((s) => s.id === seg.surveyId) || null : null);
  return (
    <section className="now-next" ref={ref}>
      {current && (
        <article className="now-card reveal in">
          <div className="now-card-tag"><LiveDot /> Happening now</div>
          <h3>{current.title}</h3>
          <div className="now-card-meta">
            {current.startsAt && <span><IconClock size={14} /> {formatTimeTz(current.startsAt, detectTimezone())}–{formatTimeTz(current.endsAt, detectTimezone())}</span>}
            {current.speaker && <span><IconMic size={14} /> {current.speaker}</span>}
            {current.location && <span><IconMapPin size={14} /> {current.location}</span>}
          </div>
          {surveyFor(current) && (
            <button className="btn btn-primary btn-block rate-btn" onPointerDown={pressRipple} onClick={() => onRate((surveyFor(current) as Survey).id)}>
              <IconChart size={16} /> Rate this session
            </button>
          )}
        </article>
      )}
      {next && (
        <article className="next-card">
          <div className="next-card-tag"><IconArrowRightCircle size={15} /> Up next</div>
          <div className="next-card-body">
            <strong>{next.title}</strong>
            <span className="muted">{formatTimeTz(next.startsAt, detectTimezone())}{next.location ? ` · ${next.location}` : ""}</span>
          </div>
        </article>
      )}
    </section>
  );
}

function RateTheDay({ surveys, onRate }: { surveys: Survey[]; onRate: (id: string) => void }) {
  const ref = useReveal(60);
  return (
    <section className="rate-day reveal" ref={ref}>
      <h2 className="itin-section-title"><IconChart size={18} /> Rate the day</h2>
      <div className="rate-day-grid">
        {surveys.map((s) => (
          <button key={s.id} className="rate-day-card" onPointerDown={pressRipple} onClick={() => onRate(s.id)}>
            <span className="rate-day-live"><LiveDot /> Live</span>
            <strong>{s.title}</strong>
            {s.description && <span className="muted">{s.description}</span>}
            <span className="rate-day-go">Tap to respond <IconArrowRightCircle size={15} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TimelineItem({ seg, index, onRate }: { seg: Segment; index: number; onRate: (id: string) => void }) {
  const ref = useReveal<HTMLLIElement>(Math.min(index * 45, 360));
  return (
    <li className="timeline-item reveal" ref={ref}>
      <div className="timeline-rail">
        <span className={`timeline-node kind-${seg.kind}`}><SegmentIcon kind={seg.kind} size={16} /></span>
      </div>
      <div className="timeline-card">
        <div className="timeline-head">
          <span className="timeline-time">{formatTimeTz(seg.startsAt, detectTimezone()) || "—"}</span>
          <span className={`kind-pill kind-${seg.kind}`}>{SEGMENT_KIND_LABELS[seg.kind] || seg.kind}</span>
        </div>
        <h3 className="timeline-title">{seg.title}</h3>
        {(seg.speaker || seg.location) && (
          <div className="timeline-meta">
            {seg.speaker && <span><IconMic size={14} /> {seg.speaker}</span>}
            {seg.location && <span><IconMapPin size={14} /> {seg.location}</span>}
          </div>
        )}
        {seg.description && <p className="timeline-desc">{seg.description}</p>}
        {seg.surveyId && (
          <button className="btn btn-sm rate-inline" onPointerDown={pressRipple} onClick={() => onRate(seg.surveyId as string)}>
            <IconChart size={14} /> Rate this
          </button>
        )}
      </div>
    </li>
  );
}
