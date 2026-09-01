import { useRef, useEffect, useState, type CSSProperties } from "react";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  splitType?: "chars" | "words";
  tag?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  textAlign?: "left" | "center" | "right";
  fromY?: number;
  fromOpacity?: number;
}

/** Scroll-triggered text reveal — self-contained, no GSAP.
 *  Splits text into chars or words, reveals with staggered transition
 *  when scrolled into view via IntersectionObserver. */
export function SplitText({
  text,
  className = "",
  delay = 40,
  duration = 0.5,
  splitType = "chars",
  tag = "p",
  textAlign = "left",
  fromY = 30,
  fromOpacity = 0,
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "-50px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const items =
    splitType === "words"
      ? text.split(/(\s+)/)
      : Array.from(text);

  const Tag = tag as any;
  const wrapStyle: CSSProperties = {
    textAlign,
    display: "inline-block",
    overflow: "hidden",
  };

  return (
    <Tag ref={ref as any} className={"split-parent " + className} style={wrapStyle}>
      {items.map((item, i) => {
        const charStyle: CSSProperties = {
          display: "inline-block",
          opacity: visible ? 1 : fromOpacity,
          transform: visible
            ? "translateY(0)"
            : "translateY(" + fromY + "px)",
          transition:
            "opacity " + duration + "s ease, transform " + duration + "s cubic-bezier(0.22,1,0.36,1)",
          transitionDelay: (i * delay / 1000) + "s",
          willChange: "transform, opacity",
        };
        return (
          <span key={i} style={charStyle}>
            {item === " " ? "\u00A0" : item}
          </span>
        );
      })}
    </Tag>
  );
}
