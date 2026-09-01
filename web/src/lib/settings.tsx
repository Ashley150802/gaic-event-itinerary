// Operator settings store + provider.
//
// Everything here is client-side only (localStorage) so it works on Vercel +
// Cloudflare with zero backend writes. The provider applies theme / density /
// motion preferences to <body> so they take effect app-wide and survive
// reloads. The admin token continues to live in api.ts (single source of
// truth); we mirror its getter/setter through this context for the Settings UI.

import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import { api, getAdminToken, setAdminToken, getAuthVerified, setAuthVerified, type AuthVerifyResult } from "../api";

export type ThemeName = "aurora" | "ember" | "forest" | "violet" | "rose";
export type Density = "comfortable" | "compact";
export type ColorMode = "dark" | "light" | "system";

export interface PresentationSettings {
  showQr: boolean;
  fontScale: number; // 0.85 - 1.4
  showPercentages: boolean;
}

export interface OperatorSettings {
  theme: ThemeName;
  colorMode: ColorMode;
  density: Density;
  reduceMotion: boolean;
  defaultTemplateId: string;
  defaultOrganizer: string;
  defaultLocation: string;
  defaultTimezone: string;
  presentation: PresentationSettings;
}

export const THEMES: { id: ThemeName; label: string; swatch: [string, string] }[] = [
  { id: "aurora", label: "Mint", swatch: ["#6EFF75", "#2E8B57"] },
  { id: "ember", label: "Emerald", swatch: ["#0F7A3A", "#5bb66f"] },
  { id: "forest", label: "Canopy", swatch: ["#39d070", "#16d048"] },
  { id: "violet", label: "Neon", swatch: ["#1B6411", "#0CFF4A"] },
  { id: "rose", label: "Evergreen", swatch: ["#064E2A", "#176336"] },
];

const KEY = "surket.settings";

function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function defaultSettings(): OperatorSettings {
  return {
    theme: "aurora",
    colorMode: "dark",
    density: "comfortable",
    reduceMotion: false,
    defaultTemplateId: "",
    defaultOrganizer: "",
    defaultLocation: "",
    defaultTimezone: detectTz(),
    presentation: { showQr: true, fontScale: 1, showPercentages: true },
  };
}

export function loadSettings(): OperatorSettings {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<OperatorSettings>;
    return {
      ...base,
      ...parsed,
      presentation: { ...base.presentation, ...(parsed.presentation || {}) },
    };
  } catch {
    return base;
  }
}

function persist(s: OperatorSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function resolveColorMode(mode: ColorMode): "dark" | "light" {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  }
  return mode;
}

function applyToBody(s: OperatorSettings): void {
  if (typeof document === "undefined") return;
  const body = document.body;
  const html = document.documentElement;
  for (const t of THEMES) body.classList.remove(`theme-${t.id}`);
  body.classList.add(`theme-${s.theme}`);
  body.classList.toggle("density-compact", s.density === "compact");
  body.classList.toggle("force-reduce-motion", s.reduceMotion);
  const resolved = resolveColorMode(s.colorMode);
  html.setAttribute("data-color-mode", resolved);
  // Update theme-color meta tag
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f5f6f8" : "#0b0e14");
}

export type AuthStatus = "idle" | "checking" | "verified" | "open" | "invalid" | "error";

interface SettingsContextValue {
  settings: OperatorSettings;
  update: (patch: Partial<OperatorSettings>) => void;
  updatePresentation: (patch: Partial<PresentationSettings>) => void;
  adminToken: string;
  authStatus: AuthStatus;
  authError: string;
  setToken: (token: string) => void;
  verifyAuth: (token: string) => Promise<AuthVerifyResult | null>;
  signOut: () => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider(props: { children: ReactNode }) {
  const [settings, setSettings] = useState<OperatorSettings>(() => loadSettings());
  const [adminToken, setTokenState] = useState<string>(() => getAdminToken());
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    getAdminToken() && getAuthVerified() ? "verified" : "idle"
  );
  const [authError, setAuthError] = useState<string>("");

  useEffect(() => {
    applyToBody(settings);
    // Listen for system color-scheme changes when mode is "system"
    if (settings.colorMode === "system" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const handler = () => applyToBody(settings);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme, settings.colorMode, settings.density, settings.reduceMotion]);

  // Auto-verify stored token on mount.
  useEffect(() => {
    const stored = getAdminToken();
    if (!stored) { setAuthStatus("idle"); return; }
    if (getAuthVerified()) return; // already verified this session
    let cancelled = false;
    (async () => {
      setAuthStatus("checking");
      try {
        const res = await api.verifyToken(stored);
        if (cancelled) return;
        if (res.open) { setAuthStatus("open"); setAuthVerified(true); }
        else if (res.valid) { setAuthStatus("verified"); setAuthVerified(true); }
        else { setAuthStatus("invalid"); setAuthError(res.error || "Invalid token"); setAuthVerified(false); }
      } catch (e: any) {
        if (!cancelled) { setAuthStatus("error"); setAuthError(e?.message || "Network error"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((patch: Partial<OperatorSettings>) => {
    setSettings((prev) => { const next = { ...prev, ...patch }; persist(next); return next; });
  }, []);

  const updatePresentation = useCallback((patch: Partial<PresentationSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, presentation: { ...prev.presentation, ...patch } };
      persist(next);
      return next;
    });
  }, []);

  const setToken = useCallback((token: string) => {
    const clean = token.trim();
    setAdminToken(clean);
    setTokenState(clean);
    if (!clean) {
      setAuthStatus("idle");
      setAuthError("");
      setAuthVerified(false);
    }
  }, []);

  const verifyAuth = useCallback(async (token: string): Promise<AuthVerifyResult | null> => {
    const clean = token.trim();
    if (!clean) { setAuthStatus("idle"); return null; }
    setAuthStatus("checking");
    setAuthError("");
    try {
      const res = await api.verifyToken(clean);
      if (res.open) {
        setAdminToken(clean); setTokenState(clean);
        setAuthStatus("open"); setAuthVerified(true);
      } else if (res.valid) {
        setAdminToken(clean); setTokenState(clean);
        setAuthStatus("verified"); setAuthVerified(true);
      } else {
        setAuthStatus("invalid"); setAuthError(res.error || "Invalid token"); setAuthVerified(false);
      }
      return res;
    } catch (e: any) {
      setAuthStatus("error");
      setAuthError(e?.message || "Could not reach server");
      return null;
    }
  }, []);

  const signOut = useCallback(() => {
    setAdminToken("");
    setTokenState("");
    setAuthStatus("idle");
    setAuthError("");
    setAuthVerified(false);
  }, []);

  const reset = useCallback(() => {
    const fresh = defaultSettings();
    setSettings(fresh);
    persist(fresh);
  }, []);

  const value: SettingsContextValue = {
    settings, update, updatePresentation,
    adminToken, authStatus, authError,
    setToken, verifyAuth, signOut, reset,
  };
  return <SettingsContext.Provider value={value}>{props.children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}

// Non-hook accessor for non-component code paths (e.g. prefilling forms).
export function getSettings(): OperatorSettings { return loadSettings(); }
