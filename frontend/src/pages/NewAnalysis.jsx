import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Lock, Play, X } from "lucide-react";
import DropZone from "../components/DropZone";
import ErrorState from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { runPolicyCheck } from "../api";
import { FRAMEWORKS, MAX_BYTES, formatSize } from "../lib/format";
import { usePageSetup } from "../lib/usePageSetup";

function validate(file) {
  if (!file) return "Choose a PDF file.";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "That file isn't a PDF. Choose a .pdf file.";
  if (file.size === 0) return "That file is empty. Choose a different PDF.";
  if (file.size > MAX_BYTES) return `That file is ${formatSize(file.size)}. The limit is 3.5 MB.`;
  return "";
}

export default function NewAnalysis() {
  const headingRef = usePageSetup("New analysis");
  const navigate = useNavigate();
  const toast = useToast();
  const abortRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [framework, setFramework] = useState(FRAMEWORKS[0].value);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [step, setStep] = useState(0);

  const fw = FRAMEWORKS.find((f) => f.value === framework) ?? FRAMEWORKS[0];
  const messages = ["Reading document", `Checking ${fw.items} ${fw.label} requirements`, "Scoring findings"];

  // Cycle the progress message while the analysis runs.
  useEffect(() => {
    if (!running) return undefined;
    setStep(0);
    const timer = setInterval(() => setStep((s) => (s + 1) % 3), 3200);
    return () => clearInterval(timer);
  }, [running]);

  // Cancel any in-flight request if the person leaves the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleSelect = (files) => {
    if (!files.length) return;
    if (files.length > 1) {
      setFileError("Upload one PDF at a time.");
      return;
    }
    const picked = files[0];
    const problem = validate(picked);
    if (problem) {
      setFileError(problem); // keep any file that was already chosen
      return;
    }
    setFileError("");
    setRunError("");
    setFile(picked.type === "application/pdf" ? picked : new File([picked], picked.name, { type: "application/pdf" }));
  };

  const run = async () => {
    if (!file || running) return;
    const problem = validate(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setRunError("");
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const report = await runPolicyCheck(file, framework, controller.signal);
      // Pass the report along: it is shown even if saving to history failed.
      navigate(`/report/${encodeURIComponent(report.analysis_id)}`, { state: { report } });
    } catch (err) {
      if (err.name === "AbortError") toast.info("Analysis cancelled. Your file is still selected.");
      else setRunError(err.message || "Something went wrong. Try again.");
      setRunning(false); // the file stays selected either way
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-h1 font-semibold tracking-tight">
          New analysis
        </h1>
        <p className="max-w-prose text-fg-muted">
          Upload a policy PDF. We check it against a fixed list of requirements and show where it falls short.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="space-y-6"
        noValidate
      >
        <DropZone file={file} onSelect={handleSelect} onRemove={() => { setFile(null); setFileError(""); }} error={fileError} disabled={running} />

        <div className="space-y-2">
          <label htmlFor="framework" className="block text-sm font-semibold">
            Framework
          </label>
          <div className="relative">
            <select id="framework" className="field" value={framework} onChange={(e) => setFramework(e.target.value)} disabled={running}>
              {FRAMEWORKS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}: {f.description}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          </div>
        </div>

        {runError && <ErrorState compact title="The analysis didn't finish" message={runError} />}

        <AnimatePresence mode="wait" initial={false}>
          {running ? (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="glass space-y-4 p-6"
            >
              <div role="status" aria-live="polite" className="min-h-6 font-medium">
                {messages[step]}…
              </div>
              <div className="progress" aria-hidden="true" />
              <p className="text-sm text-fg-muted">This usually takes under a minute.</p>
              <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-3"
            >
              <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={!file} aria-describedby="run-hint">
                <Play className="size-4" aria-hidden="true" />
                {runError ? "Run analysis again" : "Run analysis"}
              </button>
              <p id="run-hint" className="flex items-start gap-2 text-sm text-fg-muted">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{file ? "Your PDF is analysed and discarded. Only the results are saved." : "Choose a PDF to continue. Your file is never stored."}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
