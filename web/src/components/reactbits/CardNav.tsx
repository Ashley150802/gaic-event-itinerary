import { useState, type CSSProperties, type ReactNode } from "react";

export interface CardNavItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}

interface CardNavProps {
  items: CardNavItem[];
  logo?: ReactNode;
  logoAlt?: string;
  className?: string;
}

/** Self-contained CardNav — no GSAP. Expandable card-style navigation
 *  where hovering an item reveals a colored panel with the label.
 *  Used as the admin sidebar navigation. */
export function CardNav({
  items,
  logo,
  className = "",
}: CardNavProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
  };

  return (
    <div className={"rb-card-nav " + className} style={wrapStyle}>
      {logo && <div className="rb-cn-logo">{logo}</div>}
      {items.map((item, i) => {
        const isActive = item.active || hoveredIdx === i;
        const itemStyle: CSSProperties = {
          background: isActive
            ? "linear-gradient(135deg, var(--accent), var(--accent-2))"
            : "var(--surface-2)",
          color: isActive ? "var(--accent-contrast)" : "var(--text-muted)",
          borderColor: isActive ? "transparent" : "var(--border)",
          transform: hoveredIdx === i ? "translateX(4px)" : "none",
          boxShadow: isActive ? "var(--shadow-soft)" : "none",
        };
        return (
          <button
            key={i}
            type="button"
            className="rb-cn-item"
            style={itemStyle}
            onClick={item.onClick}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            aria-current={item.active ? "page" : undefined}
          >
            {item.icon && <span className="rb-cn-icon">{item.icon}</span>}
            <span className="rb-cn-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
