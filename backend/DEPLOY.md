# Backend deployment (AWS Lambda + DynamoDB)

Region used below: `ap-south-1`. Use any region, but keep it the same everywhere.

## 1. Create the DynamoDB table (on-demand)

Console: DynamoDB > Tables > Create table
- Table name: `policylens-history`
- Partition key: `analysis_id` (String), no sort key
- Table settings: Customize > Capacity mode **On-demand**

Or PowerShell:

```powershell
aws dynamodb create-table `
  --table-name policylens-history `
  --attribute-definitions AttributeName=analysis_id,AttributeType=S `
  --key-schema AttributeName=analysis_id,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --region ap-south-1
```

## 2. Minimal IAM inline policy

Attach to the Lambda execution role, replacing `ACCOUNT_ID` (and the region if different):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan"],
    "Resource": "arn:aws:dynamodb:ap-south-1:ACCOUNT_ID:table/policylens-history"
  }]
}
```

Also attach the AWS managed policy `AWSLambdaBasicExecutionRole` so the function can write CloudWatch logs.

## 3. Package the function (PowerShell)

```powershell
cd policylens\backend
Remove-Item -Recurse -Force package, function.zip -ErrorAction SilentlyContinue
pip install -r requirements.txt --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all: --target package
Copy-Item app.py package\
python -c "import shutil; shutil.make_archive('function', 'zip', 'package')"
```

`shutil` is used instead of `Compress-Archive` because older Windows PowerShell writes backslash paths into zips, which Lambda cannot read. `.env` is never copied into the package.

## 4. Create the Lambda function

Console: Lambda > Create function > Author from scratch
- Runtime: **Python 3.12**
- Architecture: **x86_64**
- Execution role: the role from step 2

Then:
- Upload `function.zip` (Code > Upload from > .zip file).
- Runtime settings > Handler: `app.handler`
- Configuration > General: **Timeout 90 s**, **Memory 512 MB**
- Configuration > Environment variables:
  - `GEMINI_API_KEY` = your key
  - `GEMINI_MODEL` = `gemini-3.8-flash`
  - `GEMINI_FALLBACK_MODELS` = `gemini-3.5-flash,gemini-3.5-flash-lite`
  - `TABLE_NAME` = `policylens-history`

## 5. Function URL

Configuration > Function URL > Create
- Auth type: **NONE**
- **Leave "Configure cross-origin resource sharing (CORS)" OFF.** FastAPI sets the CORS headers; turning both on duplicates them and browsers reject the response.

If requests return 403 after creating the URL with the CLI or infrastructure code, check that the function's resource policy allows public invocation (`lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`). The console adds this for you.

Function URL requests are capped at 6 MB and file uploads are base64-encoded in transit, which is why the PDF limit is 3.5 MB.

## 6. Test with curl

In PowerShell use `curl.exe` (plain `curl` is an alias for `Invoke-WebRequest`):

```powershell
$u = "https://YOUR-FUNCTION-URL.lambda-url.ap-south-1.on.aws"
curl.exe "$u/health"
curl.exe -X POST -F "file=@C:\path\to\policy.pdf;type=application/pdf" -F "framework=GDPR" "$u/policy-check"
curl.exe "$u/history"
curl.exe "$u/analysis/ANALYSIS_ID"
```

Expected: `{"status":"ok"}`, then a full report with `analysis_id`, `score`, `counts` and 10 findings, then a history list, then the saved report.

## Update the code later

```powershell
aws lambda update-function-code --function-name YOUR-FUNCTION --zip-file fileb://function.zip --region ap-south-1
```
