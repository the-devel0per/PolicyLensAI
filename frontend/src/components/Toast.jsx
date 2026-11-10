import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, CircleX, Info, X } from "lucide-react";

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ICONS = { success: CircleCheck, error: CircleX, info: Info };
const TONES = { success: "text-met", error: "text-missing", info: "text-review" };

function ToastItem({ id, type, message, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[type];

  // Auto-dismiss, paused while hovered or focused.
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onDismiss(id), type === "error" ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [paused, id, type, onDismiss]);

  return (
    <motion.div
      role={type === "error" ? "alert" : "status"}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="glass pointer-events-auto flex items-start gap-3 bg-surface-solid py-2 pl-4 pr-2 shadow-e3"
    >
      <Icon className={`mt-3 size-5 shrink-0 ${TONES[type]}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words py-3 text-sm">{message}</p>
      <button type="button" className="btn btn-ghost icon-btn shrink-0" onClick={() => onDismiss(id)} aria-label="Dismiss notification">
        <X className="size-5" aria-hidden="true" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((type, message) => {
    counter.current += 1;
    setToasts((list) => [...list.slice(-2), { id: counter.current, type, message }]);
  }, []);

  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-96"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
