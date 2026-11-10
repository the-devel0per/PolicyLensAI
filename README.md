# PolicyLens AI

An AI policy gap checker. Upload a privacy policy PDF, pick a framework (GDPR today), and get a scored report that shows which requirements the policy meets, where it falls short, and what to fix.

> AI-assisted gap analysis. Not legal advice or a compliance certification.

## What it does

1. You upload a policy PDF (up to 3.5 MB).
2. The backend sends the PDF and a **fixed checklist** to Gemini.
3. The AI judges each requirement from the document text only: `met`, `partial`, `missing` or `needs_human_review`, with a short quote as evidence, a one-sentence gap and one concrete fix.
4. The backend validates the answer, computes the score **in code**, and returns a report.
5. The report is saved to DynamoDB (the PDF is not) so it shows up in your dashboard.

## Architecture

```
Browser (React on S3 static website, HashRouter)
        |  HTTPS, multipart / JSON
        v
Lambda Function URL (auth NONE, Lambda CORS off)
        |
        v
FastAPI + Mangum (Python 3.12)  ---->  Gemini (google-genai, PDF as bytes)
        |
        v
DynamoDB table "policylens-history"  (summary fields + report JSON string)
```

```
policylens/
  backend/    FastAPI app, requirements, env example, DEPLOY.md (AWS steps)
  frontend/   Vite + React + Tailwind v4 app (builds to dist/ for S3)
  README.md
```

## Design decisions

- **Fixed checklist.** The 10 GDPR requirements live in code (`FRAMEWORKS` in `backend/app.py`). The AI answers each item; it cannot add, remove or reword requirements. Add a framework by adding a key.
- **Score computed in code.** The AI never produces a score. Each checklist id must appear exactly once or the request fails with a generic 500. Points: met 10, partial 5, needs_human_review 5, missing 0, scaled to 0-100.
- **Human-review flag.** When the AI is unsure it must say `needs_human_review`. The UI tags those findings "Human review needed" instead of guessing.
- **No PDF stored.** The PDF is read in memory, sent to Gemini and dropped. Policy text is never logged and raw exception text is never logged or returned. Only the structured report is saved, and evidence quotes are cut to 25 words in code.
- **Accessible by default.** WCAG 2.2 AA contrast, keyboard use throughout, visible focus, skip link, reduced-motion support, status never shown by color alone.

## Limitations

- This is AI-assisted analysis. It can miss things or misread a policy. It is **not legal advice** and **not a compliance certification**.
- It judges only the text in the PDF. Scanned PDFs without readable text may produce weak results.
- Only the GDPR checklist exists, and it covers 10 headline requirements, not the whole regulation.
- `GET /history` uses a DynamoDB Scan, which is fine for a small demo table but not for large volumes.
- CORS allows all origins until you restrict it to your site URL.

## Run locally (Windows PowerShell)

Backend (needs Python 3.12, an AWS profile via `aws configure`, and the DynamoDB table from `backend/DEPLOY.md`):

```powershell
cd policylens\backend
py -3.12 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt uvicorn
Copy-Item .env.example .env
notepad .env        # set GEMINI_API_KEY, GEMINI_MODEL, TABLE_NAME, AWS_REGION
uvicorn app:app --reload --port 8000
```

Frontend (new terminal, needs Node 18+):

```powershell
cd policylens\frontend
npm install
npm run dev         # opens on http://localhost:5173, API at VITE_API_URL in .env
```

## Deploy the frontend to S3

1. Set the Function URL in `frontend/.env`: `VITE_API_URL=https://<your-function-url>` (no trailing slash).
2. Build: `cd policylens\frontend; npm run build` (creates `dist/`).
3. In S3, create a bucket. Under **Permissions**, turn off "Block all public access".
4. Under **Properties**, enable **Static website hosting** with index document `index.html`.
5. Add this bucket policy (replace `YOUR-BUCKET`):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadForWebsite",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::YOUR-BUCKET/*"
     }]
   }
   ```

6. Upload the **contents** of `dist/` (not the folder): `aws s3 sync dist s3://YOUR-BUCKET --delete`
7. Open the bucket website endpoint. Routes use `#/`, so no rewrite rules are needed.
8. Optional: once the site URL is final, replace `allow_origins=["*"]` in `backend/app.py` with that URL and redeploy.

The S3 website endpoint is HTTP only. Put CloudFront in front if you need HTTPS for the site itself.

## Test checklist

1. `GET /health` returns `{"status":"ok"}`, and the dashboard loads (empty state on a new table).
2. Upload a real privacy policy PDF: progress messages cycle, then the report opens with a score, summary and 10 findings.
3. Upload a non-PDF, an empty file and a file over 3.5 MB: each is rejected with a clear message and nothing is lost.
4. Upload an unrelated PDF (for example an invoice): the report shows the "not a policy" notice and every item missing.
5. Use the keyboard only, switch themes, and print the report: everything is reachable, themes persist, and the print view shows all findings.
