import { useState, type CSSProperties, type ReactNode } from "react";

export interface FlowingMenuItem {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
}

interface FlowingMenuProps {
  items: FlowingMenuItem[];
  className?: string;
}

/** Self-contained FlowingMenu — no GSAP. Uses CSS transitions for the
 *  marquee reveal hover effect. Each item expands a colored overlay
 *  with a scrolling marquee of the label text.
 *
 *  Hover state lives on the .rb-fm-item wrapper (NOT the <a>), because the
 *  marquee overlay sits above the link and would otherwise steal pointer
 *  events from the link, causing a hover flicker loop where the static
 *  label and the scrolling marquee text flash over each other. */
export function FlowingMenu({ items, className = "" }: FlowingMenuProps) {
  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    width: "100%",
  };
  return (
    <div className={"rb-flowing-menu " + className} style={wrapStyle}>
      {items.map((item, i) => (
        <FlowingMenuItemRow key={i} item={item} isFirst={i === 0} />
      ))}
    </div>
  );
}

function FlowingMenuItemRow({
  item,
  isFirst,
}: {
  item: FlowingMenuItem;
  isFirst: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const itemStyle: CSSProperties = {
    borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <div
      className="rb-fm-item"
      style={itemStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        className="rb-fm-link"
        href="#"
        onClick={(e) => { e.preventDefault(); item.onClick?.(); }}
      >
        {item.icon && <span className="rb-fm-icon">{item.icon}</span>}
        <span>{item.label}</span>
      </a>
      <div className={`rb-fm-marquee ${hovered ? "active" : ""}`} aria-hidden="true">
        <div className="rb-fm-marquee-inner">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="rb-fm-marquee-part">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
