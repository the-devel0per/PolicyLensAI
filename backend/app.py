"""PolicyLens AI backend: FastAPI on AWS Lambda (via Mangum).

Privacy rules enforced throughout this file:
  * The PDF and its text are never stored and never logged.
  * Raw exception text is never logged or returned: only short labels.
  * Only the structured report (short evidence quotes, gaps, fixes) is saved.
"""
import hashlib
import json
import logging
import os
import re
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
from mangum import Mangum
from pydantic import BaseModel, Field

load_dotenv()

logger = logging.getLogger("policylens")
logger.setLevel(logging.INFO)

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

MAX_PDF_BYTES = int(3.5 * 1024 * 1024)  # 3.5 MB; keep in sync with the frontend
DISCLAIMER = "AI-assisted gap analysis. Not legal advice or a compliance certification."
GENERIC_ERROR = "The analysis could not be completed. Please try again."
BUSY_ERROR = "The AI service is busy right now. Please try again in a moment."
STORAGE_ERROR = "Saved reports could not be loaded. Please try again."

MAX_RETRIES = 2            # retries per model on 503 / UNAVAILABLE (3 attempts total)
RETRY_DELAY_SECONDS = 1.5  # grows linearly: 1.5s, 3s
DEADLINE_SECONDS = 80      # stay inside the 90 s Lambda timeout
HISTORY_LIMIT = 20
MAX_SCAN_PAGES = 10        # safety cap on DynamoDB Scan pages for /history
CACHE_SIZE = 32
EVIDENCE_MAX_WORDS = 25
ID_RE = re.compile(r"[a-f0-9]{12}")

SYSTEM_PROMPT = (
    "You are a senior privacy and compliance consultant. You get a policy PDF and a numbered checklist. "
    "For EACH item decide if the policy meets it, judging ONLY from the document text, never assuming. "
    "status: met | partial | missing | needs_human_review (use the last when ambiguous or not confident). "
    "evidence: quote under 25 words copied from the policy, or empty. "
    "gap: one plain sentence (empty if met). "
    "recommendation: one concrete fix (empty if met). "
    "confidence: integer 0-100. "
    "This is AI-assisted analysis, not legal advice or a compliance certification. "
    "If the document is not a policy set document_type to not_a_policy and mark all items missing. "
    "Return ONLY JSON: {document_type, executive_summary (exactly 3 sentences for a non-technical manager), "
    "findings:[{id,status,evidence,gap,recommendation,confidence}]}"
)

# The checklist is fixed in code. The AI must not invent requirements.
# Add a framework by adding a key here (same item shape).
FRAMEWORKS: dict[str, list[dict[str, str]]] = {
    "GDPR": [
        {"id": "G1", "title": "Lawful basis", "article": "Art. 6",
         "question": "Does the policy state the lawful basis (for example consent, contract, legal obligation, legitimate interests) relied on for its processing?"},
        {"id": "G2", "title": "Purpose limitation", "article": "Art. 5(1)(b)",
         "question": "Does the policy state specific, explicit purposes for collecting personal data and commit to not using it for incompatible purposes?"},
        {"id": "G3", "title": "Data minimisation", "article": "Art. 5(1)(c)",
         "question": "Does the policy commit to collecting only personal data that is adequate, relevant and limited to what is necessary?"},
        {"id": "G4", "title": "Retention period or criteria", "article": "Art. 5(1)(e)",
         "question": "Does the policy state how long personal data is kept, or the criteria used to decide that?"},
        {"id": "G5", "title": "Data subject rights", "article": "Art. 12-22",
         "question": "Does the policy explain the rights of access, rectification, erasure and portability, and how to exercise them?"},
        {"id": "G6", "title": "Consent", "article": "Art. 7",
         "question": "Where consent is relied on, does the policy say it is freely given, specific, and can be withdrawn?"},
        {"id": "G7", "title": "Security measures", "article": "Art. 32",
         "question": "Does the policy describe appropriate technical and organisational measures that protect personal data?"},
        {"id": "G8", "title": "Breach notification", "article": "Art. 33-34",
         "question": "Does the policy describe breach handling, including notifying the supervisory authority within 72 hours and affected people where required?"},
        {"id": "G9", "title": "International transfers", "article": "Art. 44-46",
         "question": "Does the policy say whether personal data leaves the EEA and which safeguards (for example adequacy decision, standard contractual clauses) apply?"},
        {"id": "G10", "title": "Controller or DPO contact details", "article": "Art. 13, 37-39",
         "question": "Does the policy give the identity and contact details of the controller and, where appointed, the Data Protection Officer?"},
    ],
}

# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #

Status = Literal["met", "partial", "missing", "needs_human_review"]
Severity = Literal["high", "medium", "review", "none"]

SEVERITY: dict[str, Severity] = {
    "missing": "high", "partial": "medium", "needs_human_review": "review", "met": "none",
}
POINTS = {"met": 10, "partial": 5, "needs_human_review": 5, "missing": 0}


class AIFinding(BaseModel):
    id: str
    status: Status
    evidence: str = ""
    gap: str = ""
    recommendation: str = ""
    confidence: int = Field(ge=0, le=100)


class AIResult(BaseModel):
    document_type: str
    executive_summary: str
    findings: list[AIFinding]


class Counts(BaseModel):
    met: int
    partial: int
    missing: int
    needs_human_review: int


class FindingOut(BaseModel):
    id: str
    title: str
    article: str
    status: Status
    severity: Severity
    evidence: str
    gap: str
    recommendation: str
    confidence: int = Field(ge=0, le=100)


class ReportOut(BaseModel):
    analysis_id: str
    framework: str
    filename: str
    document_type: str
    executive_summary: str
    score: int = Field(ge=0, le=100)
    counts: Counts
    findings: list[FindingOut]
    created_at: str
    disclaimer: str


class PipelineError(Exception):
    """Carries a short, safe label. Never put document text in here."""

    def __init__(self, label: str):
        super().__init__(label)
        self.label = label


# --------------------------------------------------------------------------- #
# AI: the single function that talks to Gemini
# --------------------------------------------------------------------------- #

def _model_list() -> list[str]:
    primary = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
    fallbacks = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-3.5-flash-lite").split(",")
    models: list[str] = []
    for name in [primary, *[m.strip() for m in fallbacks]]:
        if name and name not in models:
            models.append(name)
    return models


def _is_unavailable(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    status = str(getattr(exc, "status", "") or "")
    return code == 503 or "UNAVAILABLE" in status.upper() or "UNAVAILABLE" in str(exc).upper()


def _checklist_prompt(checklist: list[dict[str, str]]) -> str:
    lines = [
        f"{n}. [{item['id']}] {item['title']} ({item['article']}): {item['question']}"
        for n, item in enumerate(checklist, start=1)
    ]
    ids = ", ".join(item["id"] for item in checklist)
    return (
        "Checklist (use these ids exactly; do not add or skip items):\n"
        + "\n".join(lines)
        + f"\n\nReturn exactly one finding for each of: {ids}."
    )


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("not_an_object")
    return data


def analyze_policy(pdf_bytes: bytes, checklist: list[dict[str, str]]) -> dict[str, Any]:
    """Send the PDF and the fixed checklist to Gemini; return the raw parsed JSON.

    Tries each model in order; retries twice on 503/UNAVAILABLE.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise PipelineError("missing_api_key")

    client = genai.Client(api_key=api_key)
    contents = [
        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
        _checklist_prompt(checklist),
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0,
        response_mime_type="application/json",
    )

    deadline = time.monotonic() + DEADLINE_SECONDS
    saw_unavailable = False

    for model in _model_list():
        for attempt in range(MAX_RETRIES + 1):
            if time.monotonic() > deadline:
                raise PipelineError("gemini_timeout")
            try:
                response = client.models.generate_content(model=model, contents=contents, config=config)
                return _parse_json(response.text or "")
            except Exception as exc:  # noqa: BLE001 - labels only, never the message text
                if _is_unavailable(exc):
                    saw_unavailable = True
                    logger.warning("model_unavailable model=%s attempt=%d", model, attempt + 1)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                else:
                    logger.warning("model_failed model=%s kind=%s", model, type(exc).__name__)
                break  # go to the next model

    raise PipelineError("gemini_unavailable" if saw_unavailable else "gemini_failed")


# --------------------------------------------------------------------------- #
# Validation and scoring: done in code, never by the AI
# --------------------------------------------------------------------------- #

def _limit_words(text: str, max_words: int) -> str:
    words = text.split()
    return " ".join(words[:max_words]) if len(words) > max_words else " ".join(words)


def validate_ai_result(raw: dict[str, Any], checklist: list[dict[str, str]]) -> AIResult:
    ai = AIResult.model_validate(raw)

    expected = sorted(item["id"] for item in checklist)
    got = sorted(f.id.strip() for f in ai.findings)
    if got != expected:  # missing, extra or duplicated ids
        raise PipelineError("bad_findings")

    not_a_policy = ai.document_type.strip().lower() == "not_a_policy"
    cleaned: list[AIFinding] = []
    for f in ai.findings:
        status: Status = "missing" if not_a_policy else f.status
        met = status == "met"
        cleaned.append(AIFinding(
            id=f.id.strip(),
            status=status,
            evidence="" if not_a_policy else _limit_words(f.evidence, EVIDENCE_MAX_WORDS),
            gap="" if met else f.gap.strip()[:400],
            recommendation="" if met else f.recommendation.strip()[:400],
            confidence=f.confidence,
        ))
    return AIResult(
        document_type=ai.document_type.strip()[:60] or "unknown",
        executive_summary=ai.executive_summary.strip()[:1200],
        findings=cleaned,
    )


def compute_score(statuses: list[str]) -> int:
    max_points = 10 * len(statuses)
    return int(sum(POINTS[s] for s in statuses) / max_points * 100 + 0.5) if max_points else 0


def build_report(ai: AIResult, checklist: list[dict[str, str]], framework: str, filename: str) -> dict[str, Any]:
    by_id = {f.id: f for f in ai.findings}
    findings = []
    for item in checklist:  # checklist order, not AI order
        f = by_id[item["id"]]
        findings.append({
            "id": item["id"], "title": item["title"], "article": item["article"],
            "status": f.status, "severity": SEVERITY[f.status],
            "evidence": f.evidence, "gap": f.gap, "recommendation": f.recommendation,
            "confidence": f.confidence,
        })
    statuses = [f["status"] for f in findings]
    counts = {s: statuses.count(s) for s in ("met", "partial", "missing", "needs_human_review")}
    report = {
        "analysis_id": uuid.uuid4().hex[:12],
        "framework": framework,
        "filename": filename,
        "document_type": ai.document_type,
        "executive_summary": ai.executive_summary,
        "score": compute_score(statuses),
        "counts": counts,
        "findings": findings,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "disclaimer": DISCLAIMER,
    }
    return ReportOut.model_validate(report).model_dump()


# --------------------------------------------------------------------------- #
# Storage (DynamoDB) and cache
# --------------------------------------------------------------------------- #

def get_table():
    return boto3.resource("dynamodb").Table(os.getenv("TABLE_NAME", "policylens-history"))


def _to_native(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _to_native(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_native(v) for v in value]
    return value


def save_report(report: dict[str, Any]) -> bool:
    """Save summary attributes plus the full report as a JSON string. Never raises."""
    try:
        get_table().put_item(Item={
            "analysis_id": report["analysis_id"],
            "filename": report["filename"],
            "framework": report["framework"],
            "score": report["score"],        # int
            "counts": report["counts"],      # ints
            "created_at": report["created_at"],
            "report": json.dumps(report, separators=(",", ":")),  # ints only: no floats for DynamoDB
        })
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("save_failed kind=%s", type(exc).__name__)
        return False


_CACHE: "OrderedDict[str, AIResult]" = OrderedDict()


def _cache_get(key: str) -> AIResult | None:
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    return None


def _cache_put(key: str, value: AIResult) -> None:
    _CACHE[key] = value
    _CACHE.move_to_end(key)
    while len(_CACHE) > CACHE_SIZE:
        _CACHE.popitem(last=False)


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #

app = FastAPI(title="PolicyLens AI", docs_url=None, redoc_url=None, openapi_url=None)

# CORS: allow all origins for now. TODO: restrict allow_origins to the S3 site URL later.
# Keep Lambda Function URL CORS OFF so only this middleware sets the headers.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def _bad_request(_: Request, __: RequestValidationError):
    return JSONResponse(status_code=400, content={"detail": "The request was not valid."})


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/policy-check", response_model=ReportOut)
async def policy_check(file: UploadFile | None = File(None), framework: str = Form("GDPR")):
    fw = (framework or "GDPR").strip().upper()
    checklist = FRAMEWORKS.get(fw)
    if checklist is None:
        raise HTTPException(400, f"Unknown framework. Supported: {', '.join(FRAMEWORKS)}.")
    if file is None:
        raise HTTPException(400, "Please attach a PDF in the 'file' field.")
    if (file.content_type or "").split(";")[0].strip().lower() != "application/pdf":
        raise HTTPException(400, "Please upload a PDF file.")

    data = await file.read(MAX_PDF_BYTES + 1)
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(400, "The PDF is larger than the 3.5 MB limit.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "The file does not look like a valid PDF.")

    filename = re.sub(r"[\x00-\x1f\x7f]", "", os.path.basename(file.filename or "policy.pdf"))[:120] or "policy.pdf"
    cache_key = f"{hashlib.sha256(data).hexdigest()}:{_model_list()[0]}:{fw}"

    try:
        ai = _cache_get(cache_key)
        if ai is None:
            raw = await run_in_threadpool(analyze_policy, data, checklist)
            ai = validate_ai_result(raw, checklist)
            _cache_put(cache_key, ai)
        report = build_report(ai, checklist, fw, filename)
    except PipelineError as exc:
        logger.error("analysis_failed label=%s", exc.label)
        if exc.label in ("gemini_unavailable", "gemini_timeout"):
            raise HTTPException(503, BUSY_ERROR)
        raise HTTPException(500, GENERIC_ERROR)
    except Exception as exc:  # noqa: BLE001
        logger.error("analysis_failed label=unexpected kind=%s", type(exc).__name__)
        raise HTTPException(500, GENERIC_ERROR)
    finally:
        del data  # the PDF is never kept

    await run_in_threadpool(save_report, report)  # a failed save still returns the report
    return report


@app.get("/history")
def history():
    names = {"#a": "analysis_id", "#f": "filename", "#fw": "framework", "#s": "score", "#c": "counts", "#t": "created_at"}
    kwargs: dict[str, Any] = {"ProjectionExpression": ", ".join(names), "ExpressionAttributeNames": names}
    items: list[dict[str, Any]] = []
    try:
        table = get_table()
        for _ in range(MAX_SCAN_PAGES):
            resp = table.scan(**kwargs)
            items.extend(resp.get("Items", []))
            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                break
            kwargs["ExclusiveStartKey"] = last_key
    except Exception as exc:  # noqa: BLE001
        logger.error("history_failed kind=%s", type(exc).__name__)
        raise HTTPException(500, STORAGE_ERROR)

    items = [_to_native(i) for i in items]
    items.sort(key=lambda i: i.get("created_at", ""), reverse=True)
    return [
        {k: i.get(k) for k in ("analysis_id", "filename", "framework", "score", "counts", "created_at")}
        for i in items[:HISTORY_LIMIT]
    ]


@app.get("/analysis/{analysis_id}")
def get_analysis(analysis_id: str):
    if not ID_RE.fullmatch(analysis_id):
        raise HTTPException(404, "Report not found.")
    try:
        item = get_table().get_item(Key={"analysis_id": analysis_id}).get("Item")
    except Exception as exc:  # noqa: BLE001
        logger.error("get_failed kind=%s", type(exc).__name__)
        raise HTTPException(500, STORAGE_ERROR)
    if not item:
        raise HTTPException(404, "Report not found.")
    try:
        return _to_native(json.loads(item["report"]))
    except Exception as exc:  # noqa: BLE001
        logger.error("report_unreadable kind=%s", type(exc).__name__)
        raise HTTPException(500, STORAGE_ERROR)


handler = Mangum(app, lifespan="off")
