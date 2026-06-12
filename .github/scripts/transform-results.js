const fs = require('fs');
const path = require('path');

const SPEC_PREFIX = 'tests/specs/';
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const BRACKET_ANSI_PATTERN = /\[[0-9;]*m/g;
const SUITE_TAG_PATTERN = /@[\w-]+/g;

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

function isFailureStatus(playwrightStatus) {
  return playwrightStatus === 'failed' || playwrightStatus === 'timedOut';
}

function stripAnsiCodes(value) {
  if (!value) {
    return value;
  }
  return String(value).replace(ANSI_PATTERN, '').replace(BRACKET_ANSI_PATTERN, '');
}

function cleanSuiteName(suiteName) {
  if (!suiteName) {
    return suiteName;
  }
  return suiteName.replace(SUITE_TAG_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function formatLabels(tags = [], suiteTitle = '') {
  const labels = new Set();

  tags.forEach((tag) => {
    labels.add(tag.startsWith('@') ? tag : `@${tag}`);
  });

  const titleTags = suiteTitle.match(SUITE_TAG_PATTERN) || [];
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
    'smoke-payload': 'smoke-tests',
    'functional-payload': 'functional-tests',
    'ui-ux-payload': 'ui-ux-tests',
  };

  if (mapping[rawName]) {
    return mapping[rawName];
  }

  return rawName
    .replace(/-test-results$/i, '-tests')
    .replace(/-payload$/i, '-tests')
    .replace(/-results$/i, '')
    .toLowerCase();
}

function extractErrorLog(result) {
  let raw = null;

  if (result.error?.stack) {
    raw = result.error.stack;
  } else if (result.error?.message) {
    raw = result.error.message;
  } else if (Array.isArray(result.errors) && result.errors.length > 0) {
    raw = result.errors
      .map((entry) => entry.stack || entry.message || String(entry))
      .join('\n');
  }

  return raw ? stripAnsiCodes(raw) : null;
}

function collectAttemptErrors(results) {
  const allErrors = [];

  results.forEach((result, index) => {
    const cleanedError = extractErrorLog(result);
    if (!cleanedError) {
      return;
    }

    if (results.length > 1) {
      allErrors.push(`Attempt ${index + 1}:\n${cleanedError}`);
    } else {
      allErrors.push(cleanedError);
    }
  });

  return allErrors.length > 0 ? allErrors.join('\n\n---\n\n') : null;
}

function resolveFinalTestResult(results) {
  if (!results || results.length === 0) {
    return null;
  }

  const lastResult = results[results.length - 1];
  const previousResults = results.slice(0, -1);
  let finalStatus = mapStatus(lastResult.status);
  let isFlaky = false;

  const hadFailures = previousResults.some((result) => isFailureStatus(result.status));

  if (finalStatus === 'passed' && hadFailures) {
    finalStatus = 'flaky';
    isFlaky = true;
  }

  return {
    status: finalStatus,
    duration_ms: Math.round(lastResult.duration || 0),
    started_at: new Date(lastResult.startTime || Date.now()).toISOString(),
    error_log: collectAttemptErrors(results),
    is_flaky: isFlaky,
    retry_count: Math.max(0, results.length - 1),
  };
}

function getJobDurationMs(jobStartedAt, jobCompletedAt) {
  if (jobStartedAt && jobCompletedAt) {
    return Math.max(0, new Date(jobCompletedAt).getTime() - new Date(jobStartedAt).getTime());
  }
  return null;
}

function processReport(report, jobName, jobTiming = {}) {
  const testCaseMap = new Map();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let flaky = 0;

  function walkSuite(suite) {
    if (suite.specs) {
      suite.specs.forEach((spec) => {
        const rawSuiteTitle = suite.title || 'default-suite';
        const suiteName = cleanSuiteName(rawSuiteTitle) || 'default-suite';
        const testKey = `${spec.title}::${suiteName}`;
        const labels = formatLabels(spec.tags, rawSuiteTitle);
        const filePath = normalizeFilePath(spec.file);

        spec.tests.forEach((test) => {
          const resolved = resolveFinalTestResult(test.results || []);
          if (!resolved) {
            return;
          }

          if (resolved.status === 'passed') passed += 1;
          else if (resolved.status === 'failed') failed += 1;
          else if (resolved.status === 'flaky') flaky += 1;
          else skipped += 1;

          if (!testCaseMap.has(testKey)) {
            testCaseMap.set(testKey, {
              test_name: spec.title,
              suite_name: suiteName,
              file_path: filePath,
              labels,
              results: [resolved],
            });
          } else {
            testCaseMap.get(testKey).results = [resolved];
          }
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

  const durationMs =
    getJobDurationMs(jobTiming.startedAt, jobTiming.completedAt) ??
    Math.round(report.stats?.duration || 0);

  return {
    job_name: jobName,
    status: failed > 0 ? 'failure' : 'success',
    total_tests: passed + failed + skipped + flaky,
    passed_tests: passed,
    failed_tests: failed,
    skipped_tests: skipped,
    flaky_tests: flaky,
    duration_ms: durationMs,
    started_at: jobTiming.startedAt || null,
    completed_at: jobTiming.completedAt || null,
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
      return { report, jobName, source: filePath, jobTiming: {} };
    });
  }

  if (!fs.existsSync(singleReportPath)) {
    throw new Error(`Playwright report not found at ${singleReportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(singleReportPath, 'utf8'));
  const jobName = process.env.JOB_NAME || 'playwright-tests';
  return [{
    report,
    jobName,
    source: singleReportPath,
    jobTiming: {
      startedAt: process.env.JOB_STARTED_AT || null,
      completedAt: process.env.JOB_COMPLETED_AT || null,
    },
  }];
}

function buildPipelineTiming(jobs) {
  const pipelineStartedAt = process.env.PIPELINE_STARTED_AT;
  const pipelineCompletedAt = process.env.PIPELINE_COMPLETED_AT;

  if (pipelineStartedAt && pipelineCompletedAt) {
    const durationMs = getJobDurationMs(pipelineStartedAt, pipelineCompletedAt) || 0;
    return {
      started_at: pipelineStartedAt,
      finished_at: pipelineCompletedAt,
      duration_ms: durationMs,
    };
  }

  if (pipelineStartedAt && jobs.length === 1 && jobs[0].completed_at) {
    const durationMs = getJobDurationMs(pipelineStartedAt, jobs[0].completed_at) || jobs[0].duration_ms;
    return {
      started_at: pipelineStartedAt,
      finished_at: jobs[0].completed_at,
      duration_ms: durationMs,
    };
  }

  const now = new Date().toISOString();
  return {
    started_at: pipelineStartedAt || now,
    finished_at: null,
    duration_ms: 0,
  };
}

function logDurationAnalysis(timing, jobs) {
  console.log('\nDuration analysis:');
  console.log(`   Pipeline duration (GitHub wall-clock): ${timing.duration_ms}ms`);
  jobs.forEach((job) => {
    console.log(`   Job "${job.job_name}": ${job.duration_ms}ms`);
  });
  console.log('   Test durations use the last attempt only; retries are not counted as separate tests.');
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
    .map(({ report, jobName, source, jobTiming }) => {
      console.log(`Processing ${jobName} from ${source}`);
      return processReport(report, jobName, jobTiming);
    })
    .filter(Boolean);

  if (jobs.length === 0) {
    console.error('No test results found in Playwright report(s).');
    process.exit(1);
  }

  const timing = buildPipelineTiming(jobs);
  const hasFailures = jobs.some((job) => job.status === 'failure');

  const payload = {
    pipeline: {
      pipeline_id: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
      pipeline_name: process.env.GITHUB_WORKFLOW || 'Local Test Run',
      repository: process.env.GITHUB_REPOSITORY || 'local/testing',
      branch: process.env.GITHUB_REF_NAME || 'main',
      status: hasFailures ? 'failure' : 'success',
      started_at: timing.started_at,
      finished_at: timing.finished_at,
      duration_ms: timing.duration_ms,
    },
    jobs,
  };

  logDurationAnalysis(timing, jobs);

  const outputPath = process.env.PAYLOAD_OUTPUT_PATH || 'test-results-payload.json';
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  const totals = jobs.reduce(
    (acc, job) => ({
      total: acc.total + job.total_tests,
      passed: acc.passed + job.passed_tests,
      failed: acc.failed + job.failed_tests,
      skipped: acc.skipped + job.skipped_tests,
      flaky: acc.flaky + (job.flaky_tests || 0),
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
  );

  console.log('\nPayload generated successfully');
  console.log(`   Pipeline: ${payload.pipeline.pipeline_name}`);
  console.log(`   Status: ${payload.pipeline.status}`);
  console.log(`   Duration: ${timing.duration_ms}ms (${(timing.duration_ms / 1000).toFixed(2)}s)`);
  console.log(`   Jobs: ${jobs.length}`);
  console.log(`   Total tests: ${totals.total}`);
  console.log(`   Passed: ${totals.passed}`);
  console.log(`   Failed: ${totals.failed}`);
  console.log(`   Flaky: ${totals.flaky}`);
  console.log(`   Skipped: ${totals.skipped}`);
  console.log(`   Payload saved to: ${outputPath}`);
}

main();
