// Share surface: turns any URL into a scannable QR code + copy / native-share /
// open actions. Used by operators to hand a survey or itinerary link to a room
// full of attendees. The QR is generated on-device (see lib/qrcode) so there is
// no third-party QR service and no network dependency.

import { useMemo, useState, type CSSProperties } from "react";
import { encodeQr, qrToSvgPath } from "../lib/qrcode";
import { Button, useToast } from "./ui";
import { IconCopy, IconExternal, IconShare, IconCheck } from "./icons";
import { pressRipple } from "../lib/motion";

export function QrCanvas({ value, size = 200, ecc = "medium" as const }: { value: string; size?: number; ecc?: "low" | "medium" | "quartile" | "high" }) {
  const { path, dimension } = useMemo(() => {
    const matrix = encodeQr(value, ecc);
    return qrToSvgPath(matrix, 4);
  }, [value, ecc]);
  const wrapStyle: CSSProperties = { width: size, height: size };
  return (
    <div className="qr-canvas" style={wrapStyle}>
      <svg viewBox={`0 0 ${dimension} ${dimension}`} width={size} height={size} role="img" aria-label="QR code" shapeRendering="crispEdges">
        <rect width={dimension} height={dimension} fill="#ffffff" rx="1" />
        <path d={path} fill="#0b0e14" />
      </svg>
    </div>
  );
}

export function SharePanel(props: { url: string; title?: string; caption?: string; ecc?: "low" | "medium" | "quartile" | "high" }) {
  const { url, title = "GAIC EVENT ITINERARY", caption, ecc = "medium" } = props;
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.push("Link copied", "ok");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.push("Could not copy link", "err");
    }
  };

  const nativeShare = async () => {
    const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, text: caption || title, url });
      } catch {
        /* user dismissed */
      }
    } else {
      void copy();
    }
  };

  return (
    <div className="share-panel">
      <QrCanvas value={url} ecc={ecc} />
      <div className="share-url" title={url}>{url}</div>
      {caption && <p className="muted share-caption">{caption}</p>}
      <div className="share-actions">
        <Button variant="primary" onPointerDown={pressRipple} onClick={nativeShare}>
          <IconShare size={16} /> Share
        </Button>
        <Button variant="default" onPointerDown={pressRipple} onClick={copy}>
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />} {copied ? "Copied" : "Copy link"}
        </Button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">
          <IconExternal size={16} /> Open
        </a>
      </div>
    </div>
  );
}
