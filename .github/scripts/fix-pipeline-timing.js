const fs = require('fs');

const payloadPath = process.argv[2] || process.env.PAYLOAD_PATH || 'test-results-payload.json';

function toMs(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function fixPipelineTiming(payload) {
  const jobs = payload.jobs || [];
  if (jobs.length === 0) {
    throw new Error('Payload has no jobs');
  }

  const useEnv = process.env.USE_PIPELINE_ENV === 'true';

  const startCandidates = [
    toMs(payload.pipeline?.started_at),
    ...(useEnv ? [toMs(process.env.PIPELINE_STARTED_AT)] : []),
    ...jobs.map((job) => toMs(job.started_at)),
  ].filter((value) => value != null);

  const jobEndMs = [
    ...jobs.map((job) => toMs(job.completed_at)),
    ...jobs.map((job) => {
      const start = toMs(job.started_at);
      if (start == null || typeof job.duration_ms !== 'number') {
        return null;
      }
      return start + job.duration_ms;
    }),
  ].filter((value) => value != null);

  const maxJobEndMs = jobEndMs.length > 0 ? Math.max(...jobEndMs) : null;
  const existingFinishedMs = toMs(payload.pipeline?.finished_at);

  const endCandidates = [
    ...(useEnv ? [toMs(process.env.PIPELINE_COMPLETED_AT)] : []),
    ...(existingFinishedMs != null && (maxJobEndMs == null || existingFinishedMs >= maxJobEndMs)
      ? [existingFinishedMs]
      : []),
    ...jobEndMs,
  ].filter((value) => value != null);

  const startedMs = Math.min(...startCandidates);
  let finishedMs = Math.max(...endCandidates);

  if (finishedMs < startedMs) {
    finishedMs = startedMs;
  }

  const durationMs = finishedMs - startedMs;

  payload.pipeline.started_at = new Date(startedMs).toISOString();
  payload.pipeline.finished_at = new Date(finishedMs).toISOString();
  payload.pipeline.duration_ms = durationMs;

  return payload;
}

if (!fs.existsSync(payloadPath)) {
  console.error(`Payload not found: ${payloadPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
fixPipelineTiming(payload);
fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

console.log(`Fixed pipeline timing in ${payloadPath}`);
console.log(`   started_at: ${payload.pipeline.started_at}`);
console.log(`   finished_at: ${payload.pipeline.finished_at}`);
console.log(`   duration_ms: ${payload.pipeline.duration_ms} (${(payload.pipeline.duration_ms / 1000).toFixed(1)}s)`);
