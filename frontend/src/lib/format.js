import { CircleAlert, CircleCheck, CircleX, Eye } from "lucide-react";

export const MAX_BYTES = 3.5 * 1024 * 1024; // keep in sync with backend MAX_PDF_BYTES

// Add frameworks here as the backend gains them.
export const FRAMEWORKS = [
  { value: "GDPR", label: "GDPR", description: "EU General Data Protection Regulation", items: 10 },
];

export const STATUS = {
  met: { label: "Met", longLabel: "Met", tone: "met", icon: CircleCheck },
  partial: { label: "Partial", longLabel: "Partial", tone: "partial", icon: CircleAlert },
  missing: { label: "Missing", longLabel: "Missing", tone: "missing", icon: CircleX },
  needs_human_review: { label: "Review", longLabel: "Needs review", tone: "review", icon: Eye },
};

export const SEVERITY_LABEL = { high: "High", medium: "Medium", review: "Needs a person to check", none: "None" };

export function verdictFor(score) {
  if (score < 50) return { label: "Significant gaps", tone: "missing", icon: CircleX };
  if (score < 80) return { label: "Partially aligned", tone: "partial", icon: CircleAlert };
  return { label: "Largely aligned", tone: "met", icon: CircleCheck };
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const shortId = (id = "") => id.slice(0, 8);

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function buildSummaryText(report) {
  const v = verdictFor(report.score);
  const c = report.counts;
  const gaps = report.findings
    .filter((f) => f.status !== "met")
    .map((f) => {
      const fix = f.recommendation ? ` Fix: ${f.recommendation}` : "";
      return `- ${f.id} ${f.title} (${f.article}): ${STATUS[f.status].longLabel}. ${f.gap}${fix}`;
    });
  return [
    `PolicyLens AI report: ${report.filename}`,
    `Framework: ${report.framework}. Score: ${report.score}/100 (${v.label}).`,
    `Met ${c.met}, Partial ${c.partial}, Missing ${c.missing}, Needs review ${c.needs_human_review}.`,
    "",
    report.executive_summary,
    "",
    gaps.length ? "Open items:" : "No open items.",
    ...gaps,
    "",
    report.disclaimer,
  ].join("\n");
}
