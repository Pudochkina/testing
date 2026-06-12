const fs = require('fs');

const payloadPath = process.env.PAYLOAD_OUTPUT_PATH || 'test-results-payload.json';
const jobStartedAt = process.env.JOB_STARTED_AT;
const jobCompletedAt = process.env.JOB_COMPLETED_AT;

if (!fs.existsSync(payloadPath)) {
  console.error(`Payload not found: ${payloadPath}`);
  process.exit(1);
}

if (!jobStartedAt || !jobCompletedAt) {
  console.warn('Job timestamps missing — skipping duration patch');
  process.exit(0);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const durationMs = Math.max(
  0,
  new Date(jobCompletedAt).getTime() - new Date(jobStartedAt).getTime(),
);

if (!payload.jobs?.[0]) {
  console.error('Payload has no jobs to patch');
  process.exit(1);
}

payload.jobs[0].started_at = jobStartedAt;
payload.jobs[0].completed_at = jobCompletedAt;
payload.jobs[0].duration_ms = durationMs;

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

console.log(`Patched job "${payload.jobs[0].job_name}" duration: ${durationMs}ms`);
