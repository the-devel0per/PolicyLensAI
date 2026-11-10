import { verdictFor } from "../lib/format";

export default function ScorePill({ score }) {
  const v = verdictFor(score);
  const Icon = v.icon;
  return (
    <span className={`chip chip-${v.tone} tabular-nums`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">{score}</span>
      <span aria-hidden="true" className="opacity-80">/100</span>
      <span className="sr-only">out of 100, {v.label}</span>
    </span>
  );
}
