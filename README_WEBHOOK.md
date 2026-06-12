# Webhook Integration

This project sends Playwright test results to the monitoring backend via webhook.

**Backend:** `http://localhost:3001/api/webhook/test-results`  
**Database:** PostgreSQL (separate Docker project)

## Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Update `WEBHOOK_URL` and `WEBHOOK_SECRET` in `.env`.

3. For GitHub Actions, add repository secrets:

| Secret | Example |
|--------|---------|
| `WEBHOOK_URL` | `http://your-server:3001/api/webhook/test-results` |
| `WEBHOOK_SECRET` | Your shared secret key |

## Local Testing

```bash
# Run tests
npm test

# Transform Playwright JSON to DB-compatible payload
npm run transform

# Send payload to monitoring server
npm run webhook

# Run all steps in sequence
npm run test:and:send
```

## Payload Structure

The webhook payload matches the monitoring database schema:

```json
{
  "pipeline": {
    "pipeline_id": "1234567890",
    "pipeline_name": "Playwright Tests",
    "repository": "username/testing",
    "branch": "main",
    "status": "success",
    "started_at": "2026-06-10T10:00:00Z",
    "finished_at": "2026-06-10T10:15:30Z"
  },
  "jobs": [
    {
      "job_name": "smoke-tests",
      "status": "success",
      "total_tests": 10,
      "passed_tests": 10,
      "failed_tests": 0,
      "skipped_tests": 0,
      "duration_ms": 315000,
      "test_cases": [
        {
          "test_name": "TC-BS-001: Verify book list loads successfully",
          "suite_name": "Book List @smoke @book-list",
          "file_path": "tests/specs/book-list.spec.ts",
          "labels": ["@smoke", "@book-list"],
          "results": [
            {
              "status": "passed",
              "duration_ms": 2500,
              "started_at": "2026-06-10T10:00:10Z",
              "error_log": null
            }
          ]
        }
      ]
    }
  ]
}
```

## Duration Rules

- `job.duration_ms` = sum of all `test_cases[].results[].duration_ms`
- `pipeline.started_at` / `finished_at` span the earliest test start and latest test end
- The transform script logs warnings if durations differ by more than 1 second

## Status Cascade

- Any failed test → job `status: failure`
- Any failed job → pipeline `status: failure`

## Troubleshooting

### Connection refused

- Ensure the Express server is running on port `3001`
- Verify Docker PostgreSQL is up if the API depends on it

### Payload validation errors

- Confirm `test-results/results.json` exists after `npm test`
- Re-run `npm run transform` and inspect `test-results-payload.json`

### Duration mismatch warnings

- Normal when tests run in parallel across workers
- The script allows a 1 second tolerance
