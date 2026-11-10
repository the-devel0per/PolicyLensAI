import { motion, useReducedMotion } from "motion/react";
import { verdictFor } from "../lib/format";
import { useCountUp } from "../lib/useCountUp";

// Circular gauge: the arc sweeps and the number counts up (both skipped with reduced motion).
export default function ScoreGauge({ score }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(score);
  const verdict = verdictFor(score);
  const target = score / 100;

  return (
    <div
      role="img"
      aria-label={`Score ${score} out of 100. ${verdict.label}.`}
      className="relative mx-auto aspect-square w-44 shrink-0 sm:w-52"
    >
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--gauge-track)" strokeWidth="10" />
        <g transform="rotate(-90 60 60)">
          <motion.circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={`var(--${verdict.tone}-solid)`}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? target : 0 }}
            animate={{ pathLength: target }}
            transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.15, ease: "easeOut" }}
          />
        </g>
      </svg>
      <div aria-hidden="true" className="absolute inset-0 grid place-content-center text-center">
        <span className="text-3xl font-semibold tabular-nums">{shown}</span>
        <span className="text-sm text-fg-muted">out of 100</span>
      </div>
    </div>
  );
}
