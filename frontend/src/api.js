// Thin fetch wrapper: AbortController support, timeouts and friendly errors.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function friendlyMessage(status, detail) {
  if (status === 400 && detail) return detail; // our backend sends clean, safe 400 messages
  if (status === 404) return "We couldn't find that report. It may no longer exist.";
  if (status === 413) return "That file is too large. The limit is 3.5 MB.";
  if (status === 503) return detail || "The AI service is busy. Wait a moment, then try again.";
  if (status === 429) return "Too many requests. Wait a moment, then try again.";
  if (status >= 500) return "Something went wrong on our side. Your PDF was not stored. Try again.";
  return "The request didn't go through. Try again.";
}

async function request(path, { signal, timeoutMs = 30000, ...init } = {}) {
  if (!BASE) {
    throw new ApiError("The API address isn't set. Add VITE_API_URL to .env and rebuild.", { code: "config" });
  }

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : "";
      throw new ApiError(friendlyMessage(res.status, detail), { status: res.status });
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError" && !timedOut) throw err; // user cancelled
    throw new ApiError(
      timedOut
        ? "This is taking longer than expected. Try again in a moment."
        : "Can't reach the server. Check your connection and try again.",
      { code: timedOut ? "timeout" : "network" }
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const getHistory = (signal) => request("/history", { signal });

export const getAnalysis = (id, signal) => request(`/analysis/${encodeURIComponent(id)}`, { signal });

export function runPolicyCheck(file, framework, signal) {
  const body = new FormData();
  body.append("file", file);
  body.append("framework", framework);
  // Do not set Content-Type: the browser adds the multipart boundary.
  return request("/policy-check", { method: "POST", body, signal, timeoutMs: 100000 });
}
