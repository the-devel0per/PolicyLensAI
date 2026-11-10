import { RefreshCw, TriangleAlert } from "lucide-react";

// Explains what went wrong and how to recover. Pass onRetry for a Retry button, or children for custom actions.
export default function ErrorState({ title, message, onRetry, retryLabel = "Retry", compact = false, children }) {
  return (
    <div
      role="alert"
      className={`glass flex gap-4 border-missing-solid/40 ${compact ? "items-start p-4" : "flex-col items-center px-6 py-12 text-center"}`}
    >
      <span className={`grid shrink-0 place-items-center rounded-full bg-missing-bg text-missing ${compact ? "size-10" : "size-14"}`}>
        <TriangleAlert className={compact ? "size-5" : "size-7"} aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-2">
        <h2 className={compact ? "text-base font-semibold" : "text-xl font-semibold"}>{title}</h2>
        <p className="max-w-prose break-words text-fg-muted">{message}</p>
        {(onRetry || children) && (
          <div className={`flex flex-wrap gap-2 pt-2 ${compact ? "" : "justify-center"}`}>
            {onRetry && (
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {retryLabel}
              </button>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
