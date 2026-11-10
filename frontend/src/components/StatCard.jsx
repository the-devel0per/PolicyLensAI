import { motion } from "motion/react";
import Skeleton from "./Skeleton";

export default function StatCard({ icon: Icon, label, value, hint, loading = false, variants }) {
  return (
    <motion.div variants={variants} className="glass p-6">
      <dl>
        <dt className="flex items-center gap-2 text-sm text-fg-muted">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </dt>
        <dd className="mt-2">
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums">{value}</span>
          )}
        </dd>
        {hint && !loading && <dd className="mt-1 text-sm text-fg-muted">{hint}</dd>}
      </dl>
    </motion.div>
  );
}
