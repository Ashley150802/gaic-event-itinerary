// Small shared UI kit + a lightweight toast system. No external UI deps.

import {
  createContext, useCallback, useContext, useState,
  type ButtonHTMLAttributes, type CSSProperties, type ReactNode,
} from "react";
import { IconClose } from "./icons";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "default"; size?: "sm" | "lg"; block?: boolean }) {
  const { variant = "default", size, block, className, ...rest } = props;
  const cls = [
    "btn",
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "danger" && "btn-danger",
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    block && "btn-block",
    className,
  ].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}

export function Card(props: { children: ReactNode; className?: string; pad?: boolean; style?: CSSProperties }) {
  const { children, className, pad = true, style } = props;
  const cls = ["card", pad && "card-pad", className].filter(Boolean).join(" ");
  return <div className={cls} style={style}>{children}</div>;
}

export function Badge(props: { children: ReactNode; tone?: "live" | "good" | "accent" | "default"; dot?: boolean; pulse?: boolean }) {
  const { children, tone = "default", dot, pulse } = props;
  const cls = [
    "badge",
    tone === "live" && "badge-live",
    tone === "good" && "badge-good",
    tone === "accent" && "badge-accent",
    dot && "badge-dot",
    pulse && "pulse",
  ].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

export function Field(props: { label?: string; hint?: string; children: ReactNode }) {
  const { label, hint, children } = props;
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function Empty(props: { icon?: ReactNode; title: string; children?: ReactNode }) {
  const { icon, title, children } = props;
  const textStyle: CSSProperties = { marginTop: 8 };
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted" style={textStyle}>{children}</p>}
    </div>
  );
}

export function Modal(props: { title?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { title, onClose, children, footer } = props;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const headStyle: CSSProperties = { marginBottom: 16 };
  const footStyle: CSSProperties = { justifyContent: "flex-end", gap: 10, marginTop: 18 };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card card-pad" onClick={stop} role="dialog" aria-modal="true">
        {title && (
          <div className="row between" style={headStyle}>
            <h3>{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><IconClose size={16} /></Button>
          </div>
        )}
        {children}
        {footer && <div className="row" style={footStyle}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; message: string; tone: "ok" | "err" | "default"; }
interface ToastApi { push: (message: string, tone?: "ok" | "err" | "default") => void; }
const ToastContext = createContext<ToastApi>({ push: () => {} });

export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: "ok" | "err" | "default" = "default") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const api: ToastApi = { push };
  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "err" ? "err" : t.tone === "ok" ? "ok" : ""}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  rating: "Star rating",
  single: "Single choice",
  multi: "Multiple choice",
  number: "Number",
  text: "Open text",
  nps: "Net Promoter (0-10)",
  scale: "Scale",
  date: "Date",
};

export const SEGMENT_KIND_LABELS: Record<string, string> = {
  keynote: "Keynote",
  session: "Session",
  workshop: "Workshop",
  panel: "Panel",
  break: "Break",
  networking: "Networking",
  survey: "Survey",
};
