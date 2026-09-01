// Inline SVG icon system. Replaces all emoji across the app.
//
// Why inline SVG (not an icon font or per-icon image): every icon is a tiny
// vector drawn with `currentColor` and a shared stroke style, so there are zero
// extra network requests, they stay crisp on any DPI, they inherit text colour,
// and they cost almost nothing to render even with 100-200 concurrent viewers.
// A few icons animate purely via CSS (see styles.css) so the animation runs on
// the compositor and never blocks the main thread.

import type { CSSProperties, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "size"> {
  size?: number;
  strokeWidth?: number;
}

function Svg({ size = 18, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Svg>
);
export const IconTemplates = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="m3 12 9 4.5L21 12" /><path d="m3 16.5 9 4.5 9-4.5" /></Svg>
);
export const IconArrowRightCircle = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m12 8 4 4-4 4" /><path d="M8 12h8" /></Svg>
);
export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);
export const IconCheckCircle = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></Svg>
);
export const IconChevronUp = (p: IconProps) => (<Svg {...p}><path d="m6 15 6-6 6 6" /></Svg>);
export const IconChevronDown = (p: IconProps) => (<Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>);
export const IconPlus = (p: IconProps) => (<Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
export const IconTrash = (p: IconProps) => (
  <Svg {...p}><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /></Svg>
);
export const IconEdit = (p: IconProps) => (
  <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" /></Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></Svg>
);
export const IconQr = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3" /><path d="M21 14v7h-7" /><path d="M17 21v-1" /></Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Svg>
);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18" /><path d="M8 2v4" /><path d="M16 2v4" /></Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconMapPin = (p: IconProps) => (
  <Svg {...p}><path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Svg>
);
export const IconMic = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 19v3" /></Svg>
);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
);
export const IconSparkles = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z" /></Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" rx="1" /><rect x="12" y="7" width="3" height="10" rx="1" /><rect x="17" y="13" width="3" height="4" rx="1" /></Svg>
);
export const IconBroadcast = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.48" /><path d="M7.76 16.24a6 6 0 0 1 0-8.48" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 19.07a10 10 0 0 1 0-14.14" /></Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>
);
export const IconCoffee = (p: IconProps) => (
  <Svg {...p}><path d="M17 8h2a3 3 0 0 1 0 6h-2" /><path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><path d="M7 2v2" /><path d="M11 2v2" /></Svg>
);
export const IconHandshake = (p: IconProps) => (
  <Svg {...p}><path d="m11 17 2 2a1 1 0 0 0 1.4 0l3.6-3.6" /><path d="m8.5 13.5 2 2" /><path d="M3 11l4-4 5 1 3-2 6 5-4 4-3-3" /><path d="M3 11l3 3" /></Svg>
);
export const IconPresentation = (p: IconProps) => (
  <Svg {...p}><path d="M2 3h20" /><path d="M3 3v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3" /><path d="m9 21 3-4 3 4" /><path d="M12 13v4" /></Svg>
);
export const IconPanel = (p: IconProps) => (
  <Svg {...p}><circle cx="7" cy="8" r="2.5" /><circle cx="17" cy="8" r="2.5" /><path d="M3 19v-1a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1" /><path d="M13 19v-1a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1" /></Svg>
);
export const IconCompass = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Svg>
);
export const IconCalendarClock = (p: IconProps) => (
  <Svg {...p}><path d="M21 9V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6" /><path d="M3 9h18" /><path d="M8 2v4" /><path d="M16 2v4" /><circle cx="17.5" cy="16.5" r="3.5" /><path d="M17.5 15v1.5l1 .8" /></Svg>
);
export const IconFlag = (p: IconProps) => (
  <Svg {...p}><path d="M4 21V4" /><path d="M4 4h13l-2 4 2 4H4" /></Svg>
);
export const IconRocket = (p: IconProps) => (
  <Svg {...p}><path d="M5 13c-1.5 1.3-2 5-2 5s3.7-.5 5-2" /><path d="M12 15l-3-3a14 14 0 0 1 6-9c2.5 0 4 1.5 4 4a14 14 0 0 1-9 6Z" /><circle cx="15" cy="9" r="1.2" /></Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></Svg>
);

export const IconMonitor = (p: IconProps) => (
  <Svg {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></Svg>
);

export const IconHelpCircle = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.2 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 4" /><path d="M12 17h.01" /></Svg>
);
export const IconInbox = (p: IconProps) => (
  <Svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.5Z" /></Svg>
);
export const IconParty = (p: IconProps) => (
  <Svg {...p}><path d="M3 21l5.5-13L16 15.5 3 21Z" /><path d="M14 4c1 .8 1.2 2 .6 3" /><path d="M18 2c1.4 1 1.8 2.8 1 4.4" /><path d="M20 9c1 .2 1.8 1 2 2" /><path d="M13 10l1-1" /><path d="M17 12l1.5-.5" /></Svg>
);

// The segment-kind icon map for itinerary items.
export function SegmentIcon({ kind, ...rest }: IconProps & { kind: string }) {
  switch (kind) {
    case "keynote": return <IconMic {...rest} />;
    case "workshop": return <IconPresentation {...rest} />;
    case "panel": return <IconPanel {...rest} />;
    case "break": return <IconCoffee {...rest} />;
    case "networking": return <IconHandshake {...rest} />;
    case "survey": return <IconChart {...rest} />;
    default: return <IconCalendar {...rest} />;
  }
}

// Maps a template (by id, then category) to a crisp SVG icon so the catalog
// never renders raw emoji from the backend template data.
export function TemplateIcon({ id, category, size = 20 }: { id?: string; category?: string; size?: number }) {
  const key = (id || "").toLowerCase();
  switch (key) {
    case "ai-meetup": return <IconRocket size={size} />;
    case "conference": return <IconUsers size={size} />;
    case "workshop": return <IconPresentation size={size} />;
    case "live-pulse": return <IconBroadcast size={size} />;
    case "event-feedback": return <IconChart size={size} />;
    case "nps-pulse": return <IconStar size={size} />;
    case "product-concept": return <IconSparkles size={size} />;
    case "workshop-feedback": return <IconEdit size={size} />;
  }
  const cat = (category || "").toLowerCase();
  if (cat.includes("event") || cat.includes("conference")) return <IconCalendar size={size} />;
  if (cat.includes("feedback")) return <IconChart size={size} />;
  if (cat.includes("live") || cat.includes("pulse")) return <IconBroadcast size={size} />;
  if (cat.includes("nps")) return <IconStar size={size} />;
  if (cat.includes("product")) return <IconSparkles size={size} />;
  if (cat.includes("workshop")) return <IconPresentation size={size} />;
  return <IconTemplates size={size} />;
}

export const IconLock = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
);
export const IconShieldCheck = (p: IconProps) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconLogOut = (p: IconProps) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Svg>
);
export const IconLogIn = (p: IconProps) => (
  <Svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></Svg>
);
export const IconAlertTriangle = (p: IconProps) => (
  <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Svg>
);

// A small animated "live" indicator (pulsing ring). Animation is CSS-only.
export function LiveDot({ size = 10 }: { size?: number }) {
  const style: CSSProperties = { width: size, height: size };
  return <span className="live-dot" style={style} aria-hidden="true" />;
}
