import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  gap?: number;
  textColor?: string;
  fontWeight?: string | number;
  className?: string;
  duration?: number;
}

function DigitStrip({
  digit,
  height,
}: {
  digit: number;
  height: number;
}) {
  const stripStyle: CSSProperties = {
    transform: "translateY(-" + digit * height + "px)",
    transition: "transform 0.7s cubic-bezier(0.22,1,0.36,1)",
  };
  const digitStyle: CSSProperties = { height, width: "0.65em" };
  return (
    <span className="rb-counter-digit" style={digitStyle}>
      <span className="rb-counter-strip" style={stripStyle}>
        {Array.from({ length: 10 }, (_, n) => {
          const numStyle: CSSProperties = {
            height,
            lineHeight: height + "px",
          };
          return (
            <span key={n} className="rb-counter-num" style={numStyle}>
              {n}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Animated digit counter — self-contained, no motion/framer.
 *  Uses requestAnimationFrame for smooth count-up + CSS strip transform. */
export function Counter({
  value,
  fontSize = 80,
  padding = 5,
  gap = 10,
  textColor = "inherit",
  fontWeight = "bold",
  className = "",
  duration = 800,
}: CounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(0);
  const fromRef = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const start = performance.now();
    const delta = value - from;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + delta * eased;
      setDisplayValue(v);
      fromRef.current = v;
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const intValue = Math.round(displayValue);
  const digits = String(Math.abs(intValue)).split("");
  const height = fontSize + padding;
  const counterStyle: CSSProperties = {
    fontSize,
    gap,
    color: textColor,
    fontWeight,
    height,
  };

  return (
    <span className={"rb-counter " + className} style={counterStyle}>
      {intValue < 0 && <span className="rb-counter-sign">-</span>}
      {digits.map((d, i) => (
        <DigitStrip key={i} digit={parseInt(d, 10)} height={height} />
      ))}
    </span>
  );
}
