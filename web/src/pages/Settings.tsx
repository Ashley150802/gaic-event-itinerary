// Operator settings hub. Everything here is client-side (localStorage) so it
// works on Vercel + Cloudflare with no backend writes. Sections: Appearance,
// Admin access, Event defaults, Live presentation, and Data export.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api, ApiError } from "../api";
import type { TemplateSummary } from "../types";
import { useSettings, THEMES, type Density, type ColorMode, type AuthStatus } from "../lib/settings";
import { exportEventsCsv, exportEventsJson } from "../lib/export";
import { TIMEZONE_GROUPS, detectTimezone } from "../lib/timezone";
import { Button, Card, Badge, Field, Spinner, useToast } from "../components/ui";
import {
  IconSettings, IconCheck, IconStar, IconPresentation, IconShare, IconBroadcast, IconSparkles,
  IconSun, IconMoon, IconMonitor, IconLock, IconShieldCheck, IconLogOut, IconLogIn, IconAlertTriangle,
} from "../components/icons";

function Toggle(props: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={`switch ${props.on ? "on" : ""}`} role="switch" aria-checked={props.on}
      aria-label={props.label} onClick={() => props.onChange(!props.on)}>
      <span className="switch-knob" />
    </button>
  );
}

function Section(props: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <Card>
      <div className="set-head">
        <div className="set-ico" aria-hidden="true">{props.icon}</div>
        <div>
          <h3 className="set-title">{props.title}</h3>
          <p className="muted small set-desc">{props.desc}</p>
        </div>
      </div>
      <div className="set-body">{props.children}</div>
    </Card>
  );
}

function AuthStatusBanner({ status, error }: { status: AuthStatus; error: string }) {
  if (status === "idle" || status === "checking") return null;
  if (status === "verified" || status === "open") {
    return (
      <div className="auth-banner auth-banner-ok">
        <IconShieldCheck size={15} />
        <span>{status === "open" ? "Open mode \u2014 no token required" : "Token verified \u2014 admin access active"}</span>
      </div>
    );
  }
  if (status === "invalid") {
    return (
      <div className="auth-banner auth-banner-err">
        <IconAlertTriangle size={15} />
        <span>Invalid token \u2014 {error || "does not match the server secret."}</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="auth-banner auth-banner-err">
        <IconAlertTriangle size={15} />
        <span>Connection error \u2014 {error || "could not reach the server."}</span>
      </div>
    );
  }
  return null;
}

export function Settings() {
  const { settings, update, updatePresentation, adminToken, authStatus, authError, setToken, verifyAuth, signOut, reset } = useSettings();
  const toast = useToast();
  const [tokenDraft, setTokenDraft] = useState(adminToken);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.templates().then((c) => setTemplates(c.events)).catch(() => setTemplates([]));
  }, []);

  // Sync draft with stored token when auth state changes externally.
  useEffect(() => { setTokenDraft(adminToken); }, [adminToken]);

  const handleSignIn = async () => {
    const res = await verifyAuth(tokenDraft);
    if (!res) { toast.push("Could not reach server", "err"); return; }
    if (res.valid) toast.push(res.open ? "Server is in open mode" : "Admin access granted", "ok");
    else toast.push(res.error || "Invalid token", "err");
  };

  const handleSignOut = () => {
    signOut();
    setTokenDraft("");
    toast.push("Signed out", "ok");
  };

  const doExport = async (kind: "csv" | "json") => {
    setExporting(true);
    try {
      const events = await api.listEvents();
      if (kind === "csv") exportEventsCsv(events); else exportEventsJson(events);
      toast.push(`Exported ${events.length} events`, "ok");
    } catch (e) {
      toast.push(e instanceof ApiError ? e.message : "Export failed", "err");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head row between">
        <div>
          <div className="eyebrow">Operator</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Tune the look, access, defaults, and live presentation for your GAIC EVENT ITINERARY workspace.</p>
        </div>
        <Button variant="ghost" onClick={() => { reset(); setTokenDraft(adminToken); toast.push("Settings reset to defaults", "ok"); }}>Reset to defaults</Button>
      </div>

      <div className="stack settings-stack">
        <Section icon={<IconSparkles size={18} />} title="Appearance & brand theme"
          desc="Pick the workspace accent theme, color mode, and information density. Applies across the operator app.">
          {/*
          <div className="set-row">
            <div><div className="set-row-label">Color mode</div><div className="muted small">Switch between dark and light appearances, or follow your system preference.</div></div>
            <div className="color-mode-seg">
              {(["dark", "light", "system"] as ColorMode[]).map((m) => (
                <button key={m} type="button" className={`color-mode-btn ${settings.colorMode === m ? "on" : ""}`} onClick={() => update({ colorMode: m })}>
                  {m === "dark" ? <IconMoon size={14} /> : m === "light" ? <IconSun size={14} /> : <IconMonitor size={14} />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          */}
          <div className="swatch-row">
            {THEMES.map((t) => {
              const sw: CSSProperties = { background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` };
              const active = settings.theme === t.id;
              return (
                <button key={t.id} type="button" className={`swatch ${active ? "active" : ""}`} onClick={() => update({ theme: t.id })} aria-pressed={active}>
                  <span className="swatch-dot" style={sw}>{active ? <IconCheck size={15} /> : null}</span>
                  <span className="swatch-label">{t.label}</span>
                </button>
              );
            })}
          </div>
          <div className="set-row">
            <div><div className="set-row-label">Density</div><div className="muted small">Compact tightens spacing for dense dashboards.</div></div>
            <div className="seg">
              {(["comfortable", "compact"] as Density[]).map((d) => (
                <button key={d} type="button" className={`seg-btn ${settings.density === d ? "on" : ""}`} onClick={() => update({ density: d })}>{d}</button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <div><div className="set-row-label">Reduce motion</div><div className="muted small">Disable reveal, count-up, and ripple animations.</div></div>
            <Toggle on={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" />
          </div>
        </Section>

        <Section icon={<IconLock size={18} />} title="Admin access"
          desc="Sign in with the admin token to manage events and surveys. The token is set server-side in Cloudflare and never stored in the codebase. Respondents never need one.">

          {/* Status banner */}
          <AuthStatusBanner status={authStatus} error={authError} />

          {/* Sign-in form when not authenticated */}
          {(authStatus === "idle" || authStatus === "invalid" || authStatus === "error") && (
            <div className="auth-signin">
              <Field label="Admin token" hint="Paste the token that matches your ADMIN_TOKEN secret in Cloudflare.">
                <input
                  className="input"
                  type="password"
                  value={tokenDraft}
                  onChange={(e) => setTokenDraft(e.target.value)}
                  placeholder="Enter admin token…"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSignIn(); }}
                  autoComplete="off"
                />
              </Field>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <Button
                  variant="primary"
                  onClick={handleSignIn}
                  disabled={!tokenDraft.trim()}
                >
                  <IconLogIn size={14} /> Sign in
                </Button>
              </div>
            </div>
          )}

          {/* Checking state */}
          {authStatus === "checking" && (
            <div className="auth-checking">
              <Spinner /> <span className="muted">Verifying token against server…</span>
            </div>
          )}

          {/* Verified / open — show sign-out */}
          {(authStatus === "verified" || authStatus === "open") && (
            <div className="auth-signedin">
              <div className="row between set-row">
                <div className="row" style={{ gap: 10 }}>
                  <IconShieldCheck size={18} />
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {authStatus === "open" ? "Open mode (no server token)" : "Authenticated as admin"}
                    </div>
                    <div className="muted small">
                      {authStatus === "open"
                        ? "Server has no ADMIN_TOKEN set — all mutations are allowed."
                        : "Your token has been verified against the server secret."}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" onClick={handleSignOut}>
                  <IconLogOut size={14} /> Sign out
                </Button>
              </div>
            </div>
          )}

          {/* Cloudflare setup hint */}
          <details className="auth-setup-hint">
            <summary className="muted small" style={{ cursor: "pointer", marginTop: 12 }}>
              How to set the ADMIN_TOKEN secret in Cloudflare
            </summary>
            <div className="auth-hint-body">
              <ol>
                <li>Open a terminal authenticated with Cloudflare.</li>
                <li>Run: <code>wrangler secret put ADMIN_TOKEN</code></li>
                <li>Enter a strong token when prompted. It is stored securely in Cloudflare's secret vault — never in your code or repo.</li>
                <li>Enter the same token here to unlock admin features.</li>
                <li>Alternatively, set it in the <strong>Cloudflare Dashboard → Workers &amp; Pages → surket → Settings → Secrets</strong>.</li>
              </ol>
              <p className="muted small">Leave the secret empty for open dev mode (no authentication required).</p>
            </div>
          </details>
        </Section>

        <Section icon={<IconStar size={18} />} title="Event defaults"
          desc="Prefill new events so you create them faster. These apply when you open the New event dialog.">
          <Field label="Default starting template">
            <select className="select" value={settings.defaultTemplateId} onChange={(e) => update({ defaultTemplateId: e.target.value })}>
              <option value="">None (blank event)</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-2">
              <Field label="Default organiser"><input className="input" value={settings.defaultOrganizer} onChange={(e) => update({ defaultOrganizer: e.target.value })} placeholder="GAIC" /></Field>
            <Field label="Default location"><input className="input" value={settings.defaultLocation} onChange={(e) => update({ defaultLocation: e.target.value })} placeholder="Cape Town" /></Field>
          </div>
          <Field label="Default timezone" hint="Used for event time display across the app. Auto-detected from your browser.">
            <select className="select tz-select" value={settings.defaultTimezone} onChange={(e) => update({ defaultTimezone: e.target.value })}>
              {TIMEZONE_GROUPS.map((g) => (
                <optgroup key={g.region} label={g.region}>
                  {g.zones.map((z) => <option key={z.id} value={z.id}>{z.label} ({z.id})</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="row">
            <Button variant="ghost" size="sm" onClick={() => update({ defaultTimezone: detectTimezone() })}>Detect my timezone</Button>
          </div>
        </Section>

        <Section icon={<IconPresentation size={18} />} title="Live presentation display"
          desc="Control what the big-screen present view shows during a live survey.">
          <div className="set-row">
            <div><div className="set-row-label">Show join QR code</div><div className="muted small">Display a scannable QR alongside the join code.</div></div>
            <Toggle on={settings.presentation.showQr} onChange={(v) => updatePresentation({ showQr: v })} label="Show QR" />
          </div>
          <div className="set-row">
            <div><div className="set-row-label">Show percentages</div><div className="muted small">Show each option's share of responses next to the count.</div></div>
            <Toggle on={settings.presentation.showPercentages} onChange={(v) => updatePresentation({ showPercentages: v })} label="Show percentages" />
          </div>
          <div className="set-row">
            <div><div className="set-row-label">Question text size</div><div className="muted small">Scale the on-screen question for the room size ({Math.round(settings.presentation.fontScale * 100)}%).</div></div>
            <input type="range" className="range" min={0.85} max={1.4} step={0.05} value={settings.presentation.fontScale} onChange={(e) => updatePresentation({ fontScale: Number(e.target.value) })} />
          </div>
        </Section>

        <Section icon={<IconShare size={18} />} title="Data export"
          desc="Download your events for backup or reporting. Survey results export from each event's Analytics tab.">
          <div className="row">
            <Button variant="default" disabled={exporting} onClick={() => doExport("csv")}>Export events (CSV)</Button>
            <Button variant="default" disabled={exporting} onClick={() => doExport("json")}>Export events (JSON)</Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
