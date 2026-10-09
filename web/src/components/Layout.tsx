// App shell: persistent sidebar navigation + top bar. The full operator
// controls (theme, admin token, defaults, presentation, export) live on the
// dedicated Settings page reachable from the sidebar and top bar.

import { type ReactNode } from "react";
import { Link, useRouter } from "../router";
import { IconDashboard, IconTemplates, IconArrowRightCircle, IconSettings, IconBroadcast, IconSun, IconMoon, IconShieldCheck, IconCompass } from "./icons";
import { ColorBends } from "./reactbits/ColorBends";
import { CardNav } from "./reactbits/CardNav";
import { useSettings } from "../lib/settings";

const NAV = [
  { to: "/", label: "Dashboard", icon: <IconDashboard size={18} /> },
  { to: "/attendee", label: "Attendee portal", icon: <IconCompass size={18} /> },
  { to: "/templates", label: "Templates", icon: <IconTemplates size={18} /> },
  { to: "/join", label: "Join a survey", icon: <IconArrowRightCircle size={18} /> },
  { to: "/settings", label: "Settings", icon: <IconSettings size={18} /> },
];

export function Layout(props: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const { settings, update, adminToken, authStatus } = useSettings();
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const isDark = settings.colorMode === "dark" || (settings.colorMode === "system" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const toggleColorMode = () => {
    update({ colorMode: isDark ? "light" : "dark" });
  };
  const isAuthenticated = authStatus === "verified" || authStatus === "open";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-bg" aria-hidden="true"><ColorBends colors={["#116c2b", "#18C95A", "#073c0e"]} opacity={0.12} /></div>
        <Link to="/" className="brand">
          <img src="/GAIC logo Color.png" alt="GAIC Logo" />
          <div>
            {/* <div className="brand-name">Gauteng AI Community</div> */}
            <div className="brand-sub">Event Itinerary + live surveys</div>
          </div>
        </Link>
        <CardNav
          items={NAV.map((n) => ({
            label: n.label,
            icon: n.icon,
            active: isActive(n.to),
            onClick: () => navigate(n.to),
          }))}
        />
        {/* Admin auth indicator in sidebar */}
        <button
          type="button"
          className={`sidebar-auth ${isAuthenticated ? "is-auth" : ""}`}
          onClick={() => navigate("/settings")}
          title={isAuthenticated ? "Admin access active — click to manage" : "Sign in as admin"}
        >
          <IconShieldCheck size={14} />
          <span>{isAuthenticated ? "Admin" : "Sign in"}</span>
          <span className={`auth-dot ${isAuthenticated ? "on" : ""}`} />
        </button>
        <div className="sidebar-foot">{"GAIC EVENT ITINERARY \u00b7 Powered by GAIC"}</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong>{deriveTitle(path)}</strong>
          <div className="row">
            {/*
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleColorMode}
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
              title={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            */}
            <Link to="/settings" className="topbar-settings"><IconSettings size={15} /> Settings</Link>
          </div>
        </header>
        <main>{props.children}</main>
      </div>
    </div>
  );
}

function deriveTitle(path: string): string {
  if (path === "/") return "Dashboard";
  if (path.startsWith("/attendee")) return "Attendee portal";
  if (path.startsWith("/templates")) return "Templates";
  if (path.startsWith("/events")) return "Event workspace";
  if (path.startsWith("/surveys")) return "Survey builder";
  if (path.startsWith("/join")) return "Join";
  if (path.startsWith("/settings")) return "Settings";
  return "GAIC Event Itinerary";
}
