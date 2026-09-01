// Lightweight, dependency-free motion helpers.
//
// Design choice: instead of pulling in a JS animation runtime (GSAP) or a
// component motion library, Surket animates with CSS transforms/opacity and the
// browser's IntersectionObserver + Web Animations API. These run on the
// compositor thread, so reveal/stagger animations stay at 60fps even on a
// mid-range phone with 100-200 attendees hitting the page at once. Everything
// here also respects `prefers-reduced-motion`.

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = (): boolean => {
  if (typeof document !== "undefined" && document.body?.classList.contains("force-reduce-motion")) return true;
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
};

/**
 * Adds an `in` class to the element the first time it scrolls into view, which
 * triggers the CSS reveal transition. `delay` staggers grouped items.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(delayMs = 0) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    el.style.transitionDelay = `${delayMs}ms`;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in");
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delayMs]);
  return ref;
}

/** Smoothly counts a number up to `value` (used for big result tiles). */
export function useCountUp(value: number, durationMs = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    if (prefersReducedMotion()) { setDisplay(to); fromRef.current = to; return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

/**
 * Adds a tactile press ripple to a button-like element. Pointer-driven, cheap,
 * and automatically disabled under reduced-motion.
 */
export function pressRipple(e: React.PointerEvent<HTMLElement>): void {
  if (prefersReducedMotion()) return;
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "ripple";
  const size = Math.max(rect.width, rect.height);
  span.style.width = span.style.height = `${size}px`;
  span.style.left = `${e.clientX - rect.left - size / 2}px`;
  span.style.top = `${e.clientY - rect.top - size / 2}px`;
  el.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}
