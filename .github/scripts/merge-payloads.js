const fs = require('fs');
const path = require('path');

const RESULTS_PATH = process.env.RESULTS_PATH || 'all-results/';
const OUTPUT_PATH = process.env.PAYLOAD_OUTPUT_PATH || 'test-results-payload.json';

const PAYLOAD_FILE_NAMES = new Set([
  'test-results-payload.json',
  'test-results-payload-smoke.json',
  'test-results-payload-functional.json',
  'test-results-payload-ui-ux.json',
]);

function findPayloadFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPayloadFiles(fullPath, files);
    } else if (PAYLOAD_FILE_NAMES.has(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toMs(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function resolvePipelineTiming(mergedJobs, referencePipeline) {
  const envStartedMs = toMs(process.env.PIPELINE_STARTED_AT);
  const envCompletedMs = toMs(process.env.PIPELINE_COMPLETED_AT);

  const jobStartMs = mergedJobs
    .map((job) => toMs(job.started_at))
    .filter((value) => value != null);
  const jobEndMs = mergedJobs
    .map((job) => toMs(job.completed_at))
    .filter((value) => value != null);

  const referenceStartedMs = toMs(referencePipeline?.started_at);

  let startedMs =
    envStartedMs ??
    (jobStartMs.length > 0 ? Math.min(...jobStartMs) : null) ??
    referenceStartedMs ??
    Date.now();

  let completedMs = envCompletedMs ?? 0;
  if (jobEndMs.length > 0) {
    completedMs = Math.max(completedMs, ...jobEndMs);
  }

  if (!completedMs) {
    completedMs = startedMs;
  }

  if (completedMs < startedMs) {
    completedMs = startedMs;
  }

  const durationMs = completedMs - startedMs;

  return {
    started_at: new Date(startedMs).toISOString(),
    finished_at: new Date(completedMs).toISOString(),
    duration_ms: durationMs,
  };
}

function readPayload(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const payloadFiles = findPayloadFiles(RESULTS_PATH);

  if (payloadFiles.length === 0) {
    console.error(`No payload files found under ${RESULTS_PATH}`);
    process.exit(1);
  }

  console.log(`Found ${payloadFiles.length} payload file(s)`);

  const mergedJobs = [];
  let pipelineStatus = 'success';
  let referencePipeline = null;

  payloadFiles.forEach((filePath) => {
    const payload = readPayload(filePath);
    referencePipeline = referencePipeline || payload.pipeline;

    payload.jobs.forEach((job) => {
      mergedJobs.push(job);
      if (job.status === 'failure') {
        pipelineStatus = 'failure';
      }
    });

    console.log(`Merged ${path.relative(RESULTS_PATH, filePath)} (${payload.jobs.length} job(s))`);
  });

  const timing = resolvePipelineTiming(mergedJobs, referencePipeline);

  const mergedPayload = {
    pipeline: {
      pipeline_id: process.env.GITHUB_RUN_ID || referencePipeline?.pipeline_id || `local-${Date.now()}`,
      pipeline_name: process.env.GITHUB_WORKFLOW || referencePipeline?.pipeline_name || 'Playwright Tests',
      repository: process.env.GITHUB_REPOSITORY || referencePipeline?.repository || 'unknown/repo',
      branch: process.env.GITHUB_REF_NAME || referencePipeline?.branch || 'main',
      status: pipelineStatus,
      started_at: timing.started_at,
      finished_at: timing.finished_at,
      duration_ms: timing.duration_ms,
    },
    jobs: mergedJobs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedPayload, null, 2));

  require('child_process').execFileSync(
    process.execPath,
    [path.join(__dirname, 'fix-pipeline-timing.js'), OUTPUT_PATH],
    {
      env: { ...process.env, USE_PIPELINE_ENV: 'true' },
      stdio: 'inherit',
    },
  );

  const finalizedPayload = readPayload(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalizedPayload, null, 2));

  const totals = mergedJobs.reduce(
    (acc, job) => ({
      total: acc.total + job.total_tests,
      passed: acc.passed + job.passed_tests,
      failed: acc.failed + job.failed_tests,
      skipped: acc.skipped + job.skipped_tests,
      flaky: acc.flaky + (job.flaky_tests || 0),
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
  );

  console.log(`\nMerged payload saved to ${OUTPUT_PATH}`);
  console.log(`   Pipeline started: ${finalizedPayload.pipeline.started_at}`);
  console.log(`   Pipeline finished: ${finalizedPayload.pipeline.finished_at}`);
  console.log(`   Pipeline duration: ${finalizedPayload.pipeline.duration_ms}ms (${(finalizedPayload.pipeline.duration_ms / 1000 / 60).toFixed(2)} min)`);
  mergedJobs.forEach((job) => {
    console.log(`   Job "${job.job_name}": ${job.duration_ms}ms`);
  });
  console.log(`   Total jobs: ${mergedJobs.length}`);
  console.log(`   Total tests: ${totals.total}`);
  console.log(`   Passed: ${totals.passed}, Failed: ${totals.failed}, Flaky: ${totals.flaky}, Skipped: ${totals.skipped}`);
  console.log(`   Status: ${pipelineStatus}`);
}

main();
