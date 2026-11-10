import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Eye } from "lucide-react";
import StatusChip from "./StatusChip";
import { SEVERITY_LABEL } from "../lib/format";

export default function FindingAccordion({ finding }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const uid = useId();
  const buttonId = `finding-button-${uid}`;
  const panelId = `finding-panel-${uid}`;
  const needsReview = finding.status === "needs_human_review";

  return (
    <div className="finding-item glass overflow-hidden">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover sm:px-6"
        >
          <span className="w-9 shrink-0 font-mono text-sm text-fg-muted">{finding.id}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{finding.title}</span>
            <span className="block text-sm text-fg-muted">{finding.article}</span>
            {needsReview && (
              <span className="chip chip-review chip-sm mt-1">
                <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                Human review needed
              </span>
            )}
          </span>
          <StatusChip status={finding.status} size="sm" className="hidden sm:inline-flex" />
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="shrink-0 text-fg-muted">
            <ChevronDown className="size-5" aria-hidden="true" />
          </motion.span>
        </button>
      </h3>

      <motion.div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="finding-panel overflow-hidden"
        style={{ height: 0, opacity: 0, visibility: "hidden" }}
        initial={false}
        animate={
          open
            ? { height: "auto", opacity: 1, visibility: "visible" }
            : { height: 0, opacity: 0, transitionEnd: { visibility: "hidden" } }
        }
        transition={{ height: { duration: reduce ? 0 : 0.28, ease: "easeOut" }, opacity: { duration: 0.2, ease: "easeOut" } }}
      >
        <div className="space-y-4 border-t border-border px-4 pb-6 pt-4 sm:px-6">
          <StatusChip status={finding.status} size="sm" className="sm:hidden" />
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-semibold">Evidence from the policy</dt>
              <dd className="mt-1">
                {finding.evidence ? (
                  <blockquote className="max-w-prose border-l-2 border-accent pl-4 italic">&ldquo;{finding.evidence}&rdquo;</blockquote>
                ) : (
                  <p className="text-fg-muted">No supporting text was found in the document.</p>
                )}
              </dd>
            </div>
            {finding.gap && (
              <div>
                <dt className="text-sm font-semibold">Gap</dt>
                <dd className="mt-1 max-w-prose">{finding.gap}</dd>
              </div>
            )}
            {finding.recommendation && (
              <div>
                <dt className="text-sm font-semibold">Recommended fix</dt>
                <dd className="mt-1 max-w-prose">{finding.recommendation}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-semibold">Confidence</dt>
              <dd className="mt-2 flex items-center gap-3">
                <div
                  role="meter"
                  aria-label="Confidence"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={finding.confidence}
                  aria-valuetext={`${finding.confidence} percent`}
                  className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--gauge-track)]"
                >
                  <motion.div
                    className="conf-fill h-full origin-left rounded-full bg-accent"
                    style={{ width: `${finding.confidence}%` }}
                    initial={false}
                    animate={{ scaleX: open ? 1 : 0 }}
                    transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.1, ease: "easeOut" }}
                  />
                </div>
                <span className="text-sm tabular-nums text-fg-muted">{finding.confidence}%</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Severity</dt>
              <dd className="mt-1 text-sm text-fg-muted">{SEVERITY_LABEL[finding.severity] ?? finding.severity}</dd>
            </div>
          </dl>
        </div>
      </motion.div>
    </div>
  );
}
