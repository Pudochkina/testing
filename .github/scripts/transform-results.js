const fs = require('fs');
const path = require('path');

const DURATION_TOLERANCE_MS = 1000;
const SPEC_PREFIX = 'tests/specs/';

function mapStatus(playwrightStatus) {
  const mapping = {
    passed: 'passed',
    failed: 'failed',
    timedOut: 'failed',
    skipped: 'skipped',
    interrupted: 'skipped',
  };
  return mapping[playwrightStatus] || 'skipped';
}

function formatLabels(tags = [], suiteTitle = '') {
  const labels = new Set();

  tags.forEach((tag) => {
    labels.add(tag.startsWith('@') ? tag : `@${tag}`);
  });

  const titleTags = suiteTitle.match(/@[\w-]+/g) || [];
  titleTags.forEach((tag) => labels.add(tag));

  return [...labels];
}

function normalizeFilePath(filePath = '') {
  if (!filePath) {
    return null;
  }
  if (filePath.includes('/')) {
    return filePath.startsWith('tests/') ? filePath : `${SPEC_PREFIX}${filePath}`;
  }
  return `${SPEC_PREFIX}${filePath}`;
}

function normalizeJobName(rawName) {
  const mapping = {
    'smoke-test-results': 'smoke-tests',
    'functional-test-results': 'functional-tests',
    'ui-ux-test-results': 'ui-ux-tests',
  };

  if (mapping[rawName]) {
    return mapping[rawName];
  }

  return rawName
    .replace(/-test-results$/i, '-tests')
    .replace(/-results$/i, '')
    .toLowerCase();
}

function extractErrorLog(result) {
  if (result.error?.stack) {
    return result.error.stack;
  }
  if (result.error?.message) {
    return result.error.message;
  }
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    return result.errors
      .map((entry) => entry.stack || entry.message || String(entry))
      .join('\n');
  }
  return null;
}

function processReport(report, jobName) {
  const testCaseMap = new Map();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let jobDuration = 0;

  function walkSuite(suite) {
    if (suite.specs) {
      suite.specs.forEach((spec) => {
        const suiteName = suite.title || 'default-suite';
        const testKey = `${spec.title}::${suiteName}`;
        const labels = formatLabels(spec.tags, suiteName);
        const filePath = normalizeFilePath(spec.file);

        if (!testCaseMap.has(testKey)) {
          testCaseMap.set(testKey, {
            test_name: spec.title,
            suite_name: suiteName,
            file_path: filePath,
            labels,
            results: [],
          });
        }

        const testCase = testCaseMap.get(testKey);

        spec.tests.forEach((test) => {
          (test.results || []).forEach((result) => {
            const status = mapStatus(result.status);
            const durationMs = Math.round(result.duration || 0);
            const startedAt = new Date(result.startTime || Date.now()).toISOString();

            jobDuration += durationMs;
            if (status === 'passed') passed += 1;
            else if (status === 'failed') failed += 1;
            else skipped += 1;

            testCase.results.push({
              status,
              duration_ms: durationMs,
              started_at: startedAt,
              error_log: status === 'failed' ? extractErrorLog(result) : null,
            });
          });
        });
      });
    }

    if (suite.suites) {
      suite.suites.forEach(walkSuite);
    }
  }

  (report.suites || []).forEach(walkSuite);

  const testCases = [...testCaseMap.values()];
  if (testCases.length === 0) {
    return null;
  }

  return {
    job_name: jobName,
    status: failed > 0 ? 'failure' : 'success',
    total_tests: passed + failed + skipped,
    passed_tests: passed,
    failed_tests: failed,
    skipped_tests: skipped,
    duration_ms: jobDuration,
    test_cases: testCases,
  };
}

function findJsonFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findJsonFiles(fullPath, files);
    } else if (entry.name === 'results.json') {
      files.push(fullPath);
    }
  }
  return files;
}

function readReports() {
  const resultsPath = process.env.RESULTS_PATH;
  const singleReportPath = process.env.PLAYWRIGHT_REPORT_PATH || 'test-results/results.json';

  if (resultsPath) {
    const jsonFiles = findJsonFiles(resultsPath);
    if (jsonFiles.length === 0) {
      throw new Error(`No results.json files found under ${resultsPath}`);
    }

    return jsonFiles.map((filePath) => {
      const artifactName = path.basename(path.dirname(path.dirname(filePath)));
      const jobName = normalizeJobName(artifactName);
      const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { report, jobName, source: filePath };
    });
  }

  if (!fs.existsSync(singleReportPath)) {
    throw new Error(`Playwright report not found at ${singleReportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(singleReportPath, 'utf8'));
  const jobName = process.env.JOB_NAME || 'playwright-tests';
  return [{ report, jobName, source: singleReportPath }];
}

function buildPipelineTimestamps(jobs) {
  let earliestStart = Infinity;
  let latestEnd = 0;

  jobs.forEach((job) => {
    job.test_cases.forEach((testCase) => {
      testCase.results.forEach((result) => {
        const startMs = new Date(result.started_at).getTime();
        const endMs = startMs + (result.duration_ms || 0);
        earliestStart = Math.min(earliestStart, startMs);
        latestEnd = Math.max(latestEnd, endMs);
      });
    });
  });

  if (!Number.isFinite(earliestStart) || latestEnd === 0) {
    const now = Date.now();
    return {
      started_at: new Date(now).toISOString(),
      finished_at: new Date(now).toISOString(),
      duration_ms: 0,
    };
  }

  return {
    started_at: new Date(earliestStart).toISOString(),
    finished_at: new Date(latestEnd).toISOString(),
    duration_ms: latestEnd - earliestStart,
  };
}

function validateDurations(pipelineDurationMs, jobs) {
  const totalJobDuration = jobs.reduce((sum, job) => sum + job.duration_ms, 0);
  const pipelineDiff = Math.abs(pipelineDurationMs - totalJobDuration);

  if (pipelineDiff > DURATION_TOLERANCE_MS) {
    console.warn(
      `Duration mismatch: pipeline=${pipelineDurationMs}ms, sum(jobs)=${totalJobDuration}ms`,
    );
  }

  jobs.forEach((job) => {
    const testDuration = job.test_cases.reduce(
      (sum, testCase) => sum + testCase.results.reduce((inner, result) => inner + result.duration_ms, 0),
      0,
    );
    const jobDiff = Math.abs(job.duration_ms - testDuration);
    if (jobDiff > DURATION_TOLERANCE_MS) {
      console.warn(
        `Duration mismatch in job "${job.job_name}": job=${job.duration_ms}ms, sum(tests)=${testDuration}ms`,
      );
    }
  });
}

function main() {
  let reportEntries;
  try {
    reportEntries = readReports();
  } catch (error) {
    console.error(`Failed to read Playwright reports: ${error.message}`);
    process.exit(1);
  }

  const jobs = reportEntries
    .map(({ report, jobName, source }) => {
      console.log(`Processing ${jobName} from ${source}`);
      return processReport(report, jobName);
    })
    .filter(Boolean);

  if (jobs.length === 0) {
    console.error('No test results found in Playwright report(s).');
    process.exit(1);
  }

  const timestamps = buildPipelineTimestamps(jobs);
  const hasFailures = jobs.some((job) => job.status === 'failure');

  const payload = {
    pipeline: {
      pipeline_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
      pipeline_name: process.env.GITHUB_WORKFLOW || 'Local Test Run',
      repository: process.env.GITHUB_REPOSITORY || 'local/testing',
      branch: process.env.GITHUB_REF_NAME || 'main',
      status: hasFailures ? 'failure' : 'success',
      started_at: timestamps.started_at,
      finished_at: timestamps.finished_at,
    },
    jobs,
  };

  validateDurations(timestamps.duration_ms, jobs);

  const outputPath = process.env.PAYLOAD_OUTPUT_PATH || 'test-results-payload.json';
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  const totals = jobs.reduce(
    (acc, job) => ({
      total: acc.total + job.total_tests,
      passed: acc.passed + job.passed_tests,
      failed: acc.failed + job.failed_tests,
      skipped: acc.skipped + job.skipped_tests,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );

  console.log('\nPayload generated successfully');
  console.log(`   Pipeline: ${payload.pipeline.pipeline_name}`);
  console.log(`   Status: ${payload.pipeline.status}`);
  console.log(`   Jobs: ${jobs.length}`);
  console.log(`   Total tests: ${totals.total}`);
  console.log(`   Passed: ${totals.passed}`);
  console.log(`   Failed: ${totals.failed}`);
  console.log(`   Skipped: ${totals.skipped}`);
  console.log(`   Pipeline duration: ${timestamps.duration_ms}ms`);
  console.log(`   Sum of job durations: ${jobs.reduce((sum, job) => sum + job.duration_ms, 0)}ms`);
  console.log(`   Payload saved to: ${outputPath}`);
}

main();
