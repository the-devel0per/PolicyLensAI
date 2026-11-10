import { STATUS } from "../lib/format";

// Icon + label + optional number, so status is never conveyed by color alone.
export default function StatusChip({ status, count, size = "md", label, className = "" }) {
  const meta = STATUS[status];
  if (!meta) return null;
  const Icon = meta.icon;
  const sizeClass = size === "sm" ? "chip-sm" : size === "lg" ? "chip-lg" : "";
  return (
    <span className={`chip chip-${meta.tone} ${sizeClass} ${className}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{label ?? meta.label}</span>
      {count != null && <span className="font-semibold tabular-nums">{count}</span>}
    </span>
  );
}
