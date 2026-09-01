// Template gallery: one-click create an event or survey from a curated template.

import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "../api";
import type { TemplateCatalog } from "../types";
import { useRouter } from "../router";
import { Button, Card, Badge, Spinner, useToast } from "../components/ui";
import { TemplateIcon } from "../components/icons";
import { SplitText } from "../components/reactbits/SplitText";
import { FlowingMenu, type FlowingMenuItem } from "../components/reactbits/FlowingMenu";

export function Templates() {
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { navigate } = useRouter();
  const toast = useToast();

  useEffect(() => {
    api.templates().then(setCatalog).catch(() => setCatalog({ surveys: [], events: [] }));
  }, []);

  const useEventTemplate = async (id: string) => {
    setBusyId(id);
    try {
      const ev = await api.applyEventTemplate(id);
      toast.push("Event created from template", "ok");
      navigate(`/events/${ev.id}`);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    } finally {
      setBusyId(null);
    }
  };

  const useSurveyTemplate = async (id: string) => {
    setBusyId(id);
    try {
      const s = await api.applySurveyTemplate(id);
      toast.push("Survey created from template", "ok");
      navigate(`/surveys/${s.id}`);
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Failed", "err");
    } finally {
      setBusyId(null);
    }
  };

  if (!catalog) return <div className="page"><div className="center-screen"><Spinner /></div></div>;

  const flowingItems: FlowingMenuItem[] = catalog.events.map((t) => ({
    label: t.name,
    onClick: () => useEventTemplate(t.id),
  }));

  return (
    <div className="page">
      <div className="page-head">
        <div className="eyebrow">Templates</div>
        <SplitText text="Start from a template" tag="h1" className="page-title" splitType="chars" delay={25} duration={0.4} fromY={18} />
        <p className="page-sub">Fully-built itineraries and surveys you can publish in seconds, then customise.</p>
      </div>

      {flowingItems.length > 0 && (
        <Card style={flowingWrapStyle}>
          <div className="small muted" style={flowingLabelStyle}>Quick launch</div>
          <FlowingMenu items={flowingItems} />
        </Card>
      )}

      <h3 style={sectionStyle}>Event blueprints</h3>
      <div className="grid grid-3">
        {catalog.events.map((t) => (
          <Card key={t.id} className={t.theme ? `theme-${t.theme}` : ""}>
            <div className="row between">
              <div className="tpl-mark"><TemplateIcon id={t.id} category={t.category} size={20} /></div>
              {t.theme && <Badge tone="accent">{t.theme}</Badge>}
            </div>
            <h3 style={tplTitleStyle}>{t.name}</h3>
            <p className="muted small" style={tplDescStyle}>{t.description}</p>
            <div className="row" style={metaStyle}>
              {typeof t.segmentCount === "number" && <span className="badge">{t.segmentCount} agenda items</span>}
              {typeof t.surveyCount === "number" && <span className="badge">{t.surveyCount} surveys</span>}
            </div>
            <Button variant="primary" block onClick={() => useEventTemplate(t.id)} disabled={busyId === t.id} style={ctaStyle}>
              {busyId === t.id ? "Creating\u2026" : "Use blueprint"}
            </Button>
          </Card>
        ))}
      </div>

      <h3 style={sectionStyle}>Survey templates</h3>
      <div className="grid grid-3">
        {catalog.surveys.map((t) => (
          <Card key={t.id}>
            <div className="row between">
              <div className="tpl-mark"><TemplateIcon id={t.id} category={t.category} size={20} /></div>
              {t.category && <Badge>{t.category}</Badge>}
            </div>
            <h3 style={tplTitleStyle}>{t.name}</h3>
            <p className="muted small" style={tplDescStyle}>{t.description}</p>
            <div className="row" style={metaStyle}>
              {typeof t.questionCount === "number" && <span className="badge">{t.questionCount} questions</span>}
            </div>
            <Button block onClick={() => useSurveyTemplate(t.id)} disabled={busyId === t.id} style={ctaStyle}>
              {busyId === t.id ? "Creating\u2026" : "Use template"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

const sectionStyle: CSSProperties = { margin: "26px 0 14px" };
const flowingWrapStyle: CSSProperties = { margin: "22px 0 0", overflow: "hidden", position: "relative" };
const flowingLabelStyle: CSSProperties = { marginBottom: 10 };
const tplTitleStyle: CSSProperties = { marginTop: 14, fontSize: 17 };
const tplDescStyle: CSSProperties = { marginTop: 6, minHeight: 54 };
const metaStyle: CSSProperties = { flexWrap: "wrap", gap: 8, marginBottom: 14 };
const ctaStyle: CSSProperties = { marginTop: 4 };
