import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronRight, ClipboardCheck, FileSearch, Gauge, Plus, TriangleAlert } from "lucide-react";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ScorePill from "../components/ScorePill";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import StatusChip from "../components/StatusChip";
import { getHistory } from "../api";
import { formatDate, greeting, shortId } from "../lib/format";
import { usePageSetup } from "../lib/usePageSetup";

const STATUS_KEYS = ["met", "partial", "missing", "needs_human_review"];
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

function CountChips({ counts }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {STATUS_KEYS.map((key) => (
        <StatusChip key={key} status={key} size="sm" count={counts?.[key] ?? 0} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const headingRef = usePageSetup("Dashboard");
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    getHistory(controller.signal)
      .then((items) => setState({ status: "ready", items: Array.isArray(items) ? items : [], error: "" }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: "error", items: [], error: err.message });
      });
    return () => controller.abort();
  }, [attempt]);

  const { status, items, error } = state;
  const stats = useMemo(() => {
    const total = items.length;
    const avg = total ? Math.round(items.reduce((sum, i) => sum + (i.score ?? 0), 0) / total) : 0;
    const open = items.reduce((sum, i) => sum + (i.counts?.missing ?? 0), 0);
    return { total, avg, open };
  }, [items]);

  const loading = status === "loading";
  const hasData = status === "ready" && items.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 ref={headingRef} tabIndex={-1} className="text-h1 font-semibold tracking-tight">
            {greeting()}
          </h1>
          <p className="max-w-prose text-fg-muted">Your recent policy checks and the gaps that are still open.</p>
        </div>
        {hasData && (
          <Link to="/new" className="btn btn-primary">
            <Plus className="size-4" aria-hidden="true" />
            New analysis
          </Link>
        )}
      </div>

      <div role="status" className="sr-only">
        {loading && "Loading recent analyses"}
        {status === "ready" && `${items.length} recent ${items.length === 1 ? "analysis" : "analyses"} loaded`}
      </div>

      {status !== "error" && (
        <motion.section aria-label="Summary" variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-3">
          <StatCard variants={item} icon={ClipboardCheck} label="Audits run" value={stats.total} hint={stats.total >= 20 ? "Latest 20 shown" : undefined} loading={loading} />
          <StatCard variants={item} icon={Gauge} label="Average score" value={stats.total ? `${stats.avg}/100` : "No data"} loading={loading} />
          <StatCard variants={item} icon={TriangleAlert} label="Open high-severity gaps" value={stats.open} hint="Requirements marked missing" loading={loading} />
        </motion.section>
      )}

      <section aria-labelledby="recent-heading" className="space-y-4">
        <h2 id="recent-heading" className="text-xl font-semibold">
          Recent analyses
        </h2>

        {loading && (
          <div aria-hidden="true" className="glass space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {status === "error" && (
          <ErrorState title="We couldn't load your analyses" message={error} onRetry={() => setAttempt((a) => a + 1)} />
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState
            icon={FileSearch}
            title="No analyses yet"
            description="Upload a privacy policy PDF and see which GDPR requirements it meets, where it falls short, and what to fix first."
            actionLabel="Run your first analysis"
            actionTo="/new"
          />
        )}

        {hasData && (
          <>
            {/* Desktop: table */}
            <div className="glass hidden overflow-hidden lg:block">
              <table className="w-full text-left">
                <caption className="sr-only">Recent analyses, newest first</caption>
                <thead>
                  <tr className="border-b border-border text-sm text-fg-muted">
                    <th scope="col" className="px-4 py-3 font-medium">ID</th>
                    <th scope="col" className="px-4 py-3 font-medium">Document</th>
                    <th scope="col" className="px-4 py-3 font-medium">Score</th>
                    <th scope="col" className="px-4 py-3 font-medium">Results</th>
                    <th scope="col" className="px-4 py-3 font-medium">Date</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <motion.tbody variants={container} initial="hidden" animate="show">
                  {items.map((row) => (
                    <motion.tr key={row.analysis_id} variants={item} className="data-row relative border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-mono text-sm text-fg-muted" title={row.analysis_id}>{shortId(row.analysis_id)}</td>
                      <td className="max-w-48 px-4 py-3">
                        <p className="truncate font-medium" title={row.filename}>{row.filename}</p>
                        <p className="text-sm text-fg-muted">{row.framework}</p>
                      </td>
                      <td className="px-4 py-3"><ScorePill score={row.score ?? 0} /></td>
                      <td className="px-4 py-3"><CountChips counts={row.counts} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-fg-muted">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/report/${row.analysis_id}`} className="btn btn-ghost stretched-link" aria-label={`View report for ${row.filename}`}>
                          View report
                          <ChevronRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile and tablet: stacked cards */}
            <motion.ul variants={container} initial="hidden" animate="show" className="space-y-3 lg:hidden">
              {items.map((row) => (
                <motion.li key={row.analysis_id} variants={item}>
                  <Link to={`/report/${row.analysis_id}`} aria-label={`View report for ${row.filename}`} className="glass block space-y-3 p-4 hover:bg-surface-hover">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.filename}</p>
                        <p className="text-sm text-fg-muted">{row.framework}</p>
                      </div>
                      <ScorePill score={row.score ?? 0} />
                    </div>
                    <CountChips counts={row.counts} />
                    <div className="flex items-center justify-between text-sm text-fg-muted">
                      <span>
                        <span className="font-mono">{shortId(row.analysis_id)}</span>
                        <span className="sr-only">, </span>
                        <span className="ml-3">{formatDate(row.created_at)}</span>
                      </span>
                      <span className="inline-flex min-h-11 items-center gap-1 font-medium text-accent-fg">
                        View report
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </>
        )}
      </section>
    </div>
  );
}
