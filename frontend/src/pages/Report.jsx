import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LayoutGroup, motion } from "motion/react";
import { ArrowLeft, Copy, FilePlus2, Info, ListFilter, Printer, TriangleAlert } from "lucide-react";
import ErrorState from "../components/ErrorState";
import FindingAccordion from "../components/FindingAccordion";
import ScoreGauge from "../components/ScoreGauge";
import Skeleton from "../components/Skeleton";
import StatusChip from "../components/StatusChip";
import { useToast } from "../components/Toast";
import { getAnalysis } from "../api";
import { STATUS, buildSummaryText, formatDateTime, verdictFor } from "../lib/format";
import { usePageSetup } from "../lib/usePageSetup";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const listItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } } };

function ReportSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading report</span>
      <div aria-hidden="true" className="glass flex flex-col items-center gap-8 p-8 md:flex-row">
        <Skeleton className="size-44 shrink-0 rounded-full sm:size-52" />
        <div className="w-full space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
      <div aria-hidden="true" className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Report() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const headingRef = usePageSetup("Policy gap report");

  // A fresh analysis arrives in router state, so it still shows if saving to history failed.
  const seeded = location.state?.report?.analysis_id === id ? location.state.report : null;
  const [state, setState] = useState(seeded ? { status: "ready", report: seeded } : { status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (seeded && attempt === 0) return undefined;
    const controller = new AbortController();
    setState({ status: "loading" });
    getAnalysis(id, controller.signal)
      .then((report) => setState({ status: "ready", report }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: "error", message: err.message, notFound: err.status === 404 });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  const report = state.status === "ready" ? state.report : null;

  const counts = useMemo(() => {
    const c = { met: 0, partial: 0, missing: 0, needs_human_review: 0 };
    report?.findings.forEach((f) => {
      c[f.status] += 1;
    });
    return c;
  }, [report]);

  const visible = useMemo(
    () => (report ? report.findings.filter((f) => filter === "all" || f.status === filter) : []),
    [report, filter]
  );

  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate("/"));

  const copySummary = async () => {
    const text = buildSummaryText(report);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Summary copied to the clipboard.");
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("copy_failed");
        toast.success("Summary copied to the clipboard.");
      } catch {
        toast.error("Couldn't copy the summary. Select the text and copy it manually.");
      }
    }
  };

  const printReport = () => {
    flushSync(() => setFilter("all")); // print every finding, not just the filtered ones
    window.print();
  };

  const verdict = report ? verdictFor(report.score) : null;
  const VerdictIcon = verdict?.icon;
  const filters = [
    { key: "all", label: "All", count: report?.findings.length ?? 0 },
    { key: "missing", label: "Missing", count: counts.missing },
    { key: "partial", label: "Partial", count: counts.partial },
    { key: "needs_human_review", label: "Needs review", count: counts.needs_human_review },
    { key: "met", label: "Met", count: counts.met },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost -ml-3" onClick={goBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </button>
          <span className="flex-1" />
          {report && (
            <>
              <button type="button" className="btn btn-secondary" onClick={copySummary}>
                <Copy className="size-4" aria-hidden="true" />
                Copy summary
              </button>
              <button type="button" className="btn btn-secondary" onClick={printReport}>
                <Printer className="size-4" aria-hidden="true" />
                Print / Save PDF
              </button>
            </>
          )}
          <Link to="/new" className="btn btn-primary">
            <FilePlus2 className="size-4" aria-hidden="true" />
            New analysis
          </Link>
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 font-semibold tracking-tight">
          Policy gap report
        </h1>
      </div>

      {state.status === "loading" && <ReportSkeleton />}

      {state.status === "error" && (
        <ErrorState
          title={state.notFound ? "Report not found" : "We couldn't load this report"}
          message={state.message}
          onRetry={state.notFound ? undefined : () => setAttempt((a) => a + 1)}
        >
          <Link to="/" className="btn btn-secondary">
            Back to dashboard
          </Link>
        </ErrorState>
      )}

      {report && (
        <>
          <motion.section
            aria-label="Summary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="glass grid items-center gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr]"
          >
            <ScoreGauge score={report.score} />
            <div className="min-w-0 space-y-4">
              <span className={`chip chip-lg chip-${verdict.tone}`}>
                <VerdictIcon className="size-5 shrink-0" aria-hidden="true" />
                {verdict.label}
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-fg-muted">Document</dt>
                <dd className="min-w-0 break-words font-medium">{report.filename}</dd>
                <dt className="text-fg-muted">Framework</dt>
                <dd className="font-medium">{report.framework}</dd>
                <dt className="text-fg-muted">Analysed</dt>
                <dd className="font-medium">{formatDateTime(report.created_at)}</dd>
              </dl>
              <p className="max-w-prose text-lg">{report.executive_summary}</p>
            </div>
          </motion.section>

          {report.document_type === "not_a_policy" && (
            <div role="note" className="flex items-start gap-3 rounded-lg border border-partial-solid/50 bg-partial-bg p-4 text-partial">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="max-w-prose">
                This document doesn&apos;t look like a policy, so every requirement is marked missing. Upload your privacy or data protection policy to get a useful result.
              </p>
            </div>
          )}

          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{report.disclaimer}</span>
          </p>

          <section aria-labelledby="findings-heading" className="space-y-4">
            <h2 id="findings-heading" className="text-xl font-semibold">
              Findings
            </h2>

            <div className="no-print">
              <div role="group" aria-label="Filter findings by status" className="flex flex-wrap gap-2">
                <LayoutGroup id="finding-filters">
                  {filters.map((f) => {
                    const meta = STATUS[f.key];
                    const Icon = meta?.icon ?? ListFilter;
                    const active = filter === f.key;
                    return (
                      <button key={f.key} type="button" className="filter-chip" aria-pressed={active} onClick={() => setFilter(f.key)}>
                        {active && <motion.span layoutId="filter-pill" className="pill" transition={{ duration: 0.25, ease: "easeOut" }} />}
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span>{f.label}</span>
                        <span className="tabular-nums">{f.count}</span>
                      </button>
                    );
                  })}
                </LayoutGroup>
              </div>
            </div>

            <p role="status" aria-live="polite" className="sr-only">
              Showing {visible.length} of {report.findings.length} findings
            </p>

            {visible.length === 0 ? (
              <p className="glass p-6 text-fg-muted">No findings with this status.</p>
            ) : (
              <motion.ol key={filter} variants={list} initial="hidden" animate="show" className="space-y-3">
                {visible.map((finding) => (
                  <motion.li key={finding.id} variants={listItem}>
                    <FindingAccordion finding={finding} />
                  </motion.li>
                ))}
              </motion.ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
