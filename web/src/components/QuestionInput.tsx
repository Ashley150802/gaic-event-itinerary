// Renders an answer control for a single question. Used by both the public
// respond view and the live present preview.

import type { CSSProperties } from "react";
import type { Question } from "../types";
import { IconCheck, IconStar } from "./icons";

export type AnswerValue = string | number | string[] | null;

export function QuestionInput(props: { question: Question; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const { question, value, onChange } = props;

  if (question.type === "single") {
    return (
      <div className="opt-grid">
        {question.options.map((opt) => {
          const selected = value === opt;
          return (
            <button type="button" key={opt} className={`opt ${selected ? "selected" : ""}`} onClick={() => onChange(opt)}>
              <span className="opt-mark">{selected ? <IconCheck size={14} /> : null}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "multi") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => {
      if (arr.includes(opt)) onChange(arr.filter((x) => x !== opt));
      else onChange([...arr, opt]);
    };
    return (
      <div className="opt-grid">
        {question.options.map((opt) => {
          const selected = arr.includes(opt);
          return (
            <button type="button" key={opt} className={`opt ${selected ? "selected" : ""}`} onClick={() => toggle(opt)}>
              <span className="opt-mark square">{selected ? <IconCheck size={14} /> : null}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "rating") {
    const current = typeof value === "number" ? value : 0;
    const max = question.config.max ?? 5;
    const stars = Array.from({ length: max }, (_, i) => i + 1);
    return (
      <div className="stars">
        {stars.map((s) => (
          <span key={s} className={`star ${s <= current ? "on" : ""}`} role="button" aria-label={`${s} star`} onClick={() => onChange(s)}><IconStar size={30} /></span>
        ))}
      </div>
    );
  }

  if (question.type === "nps" || question.type === "scale") {
    const min = question.type === "nps" ? 0 : question.config.min ?? 1;
    const max = question.type === "nps" ? 10 : question.config.max ?? 5;
    const nums: number[] = [];
    for (let n = min; n <= max; n += 1) nums.push(n);
    const current = typeof value === "number" ? value : null;
    return (
      <div>
        <div className="scale-row">
          {nums.map((n) => (
            <button type="button" key={n} className={`scale-btn ${current === n ? "selected" : ""}`} onClick={() => onChange(n)}>{n}</button>
          ))}
        </div>
        {(question.config.minLabel || question.config.maxLabel) && (
          <div className="row between small faint" style={labelRowStyle}>
            <span>{question.config.minLabel}</span>
            <span>{question.config.maxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <input
        className="input"
        type="number"
        value={value === null || value === undefined ? "" : String(value)}
        min={question.config.min}
        max={question.config.max}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  }

  if (question.type === "date") {
    return (
      <input className="input" type="date" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} />
    );
  }

  // text
  return (
    <textarea
      className="textarea"
      value={typeof value === "string" ? value : ""}
      placeholder="Type your answer\u2026"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const labelRowStyle: CSSProperties = { marginTop: 8 };
