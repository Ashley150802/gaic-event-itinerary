// Dependency-free SVG / CSS charts. Animated bars are used for the live tally so
// the audience sees results move in real time.

import type { CSSProperties } from "react";

export interface Bucket {
  label: string;
  value: number;
}

export function BarChart(props: { buckets: Bucket[]; max?: number }) {
  const { buckets } = props;
  const max = props.max ?? Math.max(1, ...buckets.map((b) => b.value));
  if (buckets.length === 0) return <p className="faint small">No data yet.</p>;
  return (
    <div className="chart">
      {buckets.map((b, i) => {
        const fillStyle: CSSProperties = { width: `${Math.round((b.value / max) * 100)}%` };
        return (
          <div className="bar-row" key={`${b.label}-${i}`}>
            <span className="bar-label" title={b.label}>{b.label}</span>
            <div className="bar-track"><div className="bar-fill" style={fillStyle} /></div>
            <span className="bar-value">{b.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline(props: { points: Bucket[] }) {
  const { points } = props;
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div>
      <div className="spark">
        {points.map((p, i) => {
          const colStyle: CSSProperties = { height: `${Math.max(3, Math.round((p.value / max) * 100))}%` };
          return <div className="spark-col" key={i} style={colStyle} title={`${p.label}: ${p.value}`} />;
        })}
      </div>
      <div className="spark-axis">
        {points.map((p, i) => <span key={i}>{p.label}</span>)}
      </div>
    </div>
  );
}

const DONUT_COLORS = ["#6ea8fe", "#38d3c4", "#ffb24d", "#b08cff", "#ff8fb0", "#5fd38a"];

export function Donut(props: { data: Bucket[]; size?: number }) {
  const { data } = props;
  const size = props.size ?? 132;
  const total = data.reduce((a, b) => a + b.value, 0);
  const radius = size / 2;
  const stroke = size * 0.16;
  const r = radius - stroke / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const svgStyle: CSSProperties = { transform: "rotate(-90deg)" };
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} style={svgStyle} role="img" aria-label="Distribution">
        <circle cx={radius} cy={radius} r={r} fill="none" stroke="var(--bg-elev)" strokeWidth={stroke} />
        {total > 0 && data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * circ;
          const seg = (
            <circle
              key={i}
              cx={radius}
              cy={radius}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="legend">
        {data.map((d, i) => {
          const sw: CSSProperties = { background: DONUT_COLORS[i % DONUT_COLORS.length] };
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div className="legend-item" key={i}>
              <span className="legend-swatch" style={sw} />
              <span>{d.label} \u00b7 {pct}%</span>
            </div>
          );
        })}
        {total === 0 && <span className="faint small">No data yet.</span>}
      </div>
    </div>
  );
}

export function StatTile(props: { label: string; value: string | number; delta?: string; tone?: "good" | "bad" | "muted" }) {
  const { label, value, delta, tone } = props;
  const deltaStyle: CSSProperties = {
    color: tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : "var(--text-faint)",
  };
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && <div className="stat-delta" style={deltaStyle}>{delta}</div>}
    </div>
  );
}
