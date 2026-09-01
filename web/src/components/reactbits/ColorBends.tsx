import { type CSSProperties } from "react";

interface ColorBendsProps {
  colors?: string[];
  className?: string;
  opacity?: number;
}

/** Animated gradient mesh background — self-contained, no external deps.
 *  Creates floating, blending color orbs that drift and rotate. */
export function ColorBends({
  colors = ["#5227FF", "#FF9FFC", "#7cff67"],
  className = "",
  opacity = 0.35,
}: ColorBendsProps) {
  const wrapStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 0,
  };
  return (
    <div className={"color-bends " + className} style={wrapStyle} aria-hidden="true">
      {colors.map((color, i) => {
        const orbStyle: CSSProperties = {
          background: "radial-gradient(circle, " + color + "aa, transparent 65%)",
          opacity,
          animationDelay: i * -8 + "s",
          animationDuration: (22 + i * 6) + "s",
        };
        return (
          <div key={i} className={"color-bends-orb orb-" + i} style={orbStyle} />
        );
      })}
      <div className="color-bends-grain" />
    </div>
  );
}
