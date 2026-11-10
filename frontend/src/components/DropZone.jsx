import { useId, useState } from "react";
import { motion } from "motion/react";
import { CircleX, FileText, Upload, X } from "lucide-react";
import { formatSize } from "../lib/format";

// A native <label> wraps the prompt and a visually hidden file input sits before it,
// so click, drag-and-drop and keyboard (Tab, Enter, Space) all work without custom key handling.
export default function DropZone({ file, onSelect, onRemove, error, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) onSelect(Array.from(e.dataTransfer.files || []));
  };

  return (
    <div>
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="dz-input sr-only"
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          onSelect(Array.from(e.target.files || []));
          e.target.value = ""; // allow picking the same file again
        }}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`dropzone ${dragging ? "is-dragging" : ""} ${disabled ? "is-disabled" : ""}`}
      >
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-fg">
          <Upload className="size-7" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold">{file ? "Choose a different PDF" : "Drop your policy PDF here"}</span>
        <span className="text-sm text-fg-muted">or click to browse. PDF only, up to 3.5 MB.</span>
      </label>

      {error && (
        <p id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-sm text-missing">
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {file && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="glass mt-4 flex items-center gap-3 p-3"
        >
          <FileText className="size-6 shrink-0 text-accent-fg" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-sm text-fg-muted">{formatSize(file.size)}</p>
          </div>
          <button type="button" className="btn btn-ghost icon-btn shrink-0" onClick={onRemove} disabled={disabled} aria-label={`Remove ${file.name}`}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
