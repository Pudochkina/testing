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

function durationFromTimestamps(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return 0;
  }

  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
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

  const pipelineStartedAt =
    process.env.PIPELINE_STARTED_AT || referencePipeline?.started_at || new Date().toISOString();
  const pipelineCompletedAt =
    process.env.PIPELINE_COMPLETED_AT || referencePipeline?.finished_at || new Date().toISOString();
  const pipelineDurationMs = durationFromTimestamps(pipelineStartedAt, pipelineCompletedAt);

  const mergedPayload = {
    pipeline: {
      pipeline_id: process.env.GITHUB_RUN_ID || referencePipeline?.pipeline_id || `local-${Date.now()}`,
      pipeline_name: process.env.GITHUB_WORKFLOW || referencePipeline?.pipeline_name || 'Playwright Tests',
      repository: process.env.GITHUB_REPOSITORY || referencePipeline?.repository || 'unknown/repo',
      branch: process.env.GITHUB_REF_NAME || referencePipeline?.branch || 'main',
      status: pipelineStatus,
      started_at: pipelineStartedAt,
      finished_at: pipelineCompletedAt,
      duration_ms: pipelineDurationMs,
    },
    jobs: mergedJobs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mergedPayload, null, 2));

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
  console.log(`   Pipeline duration: ${pipelineDurationMs}ms (${(pipelineDurationMs / 1000 / 60).toFixed(2)} min)`);
  console.log(`   Total jobs: ${mergedJobs.length}`);
  console.log(`   Total tests: ${totals.total}`);
  console.log(`   Passed: ${totals.passed}, Failed: ${totals.failed}, Flaky: ${totals.flaky}, Skipped: ${totals.skipped}`);
  console.log(`   Status: ${pipelineStatus}`);
}

main();
