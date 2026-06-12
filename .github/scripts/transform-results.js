const fs = require('fs');
const path = require('path');

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

const resultsPath = process.env.RESULTS_PATH || 'all-results/';
const jsonFiles = findJsonFiles(resultsPath);

console.log(`Found ${jsonFiles.length} result files`);

const allTests = [];
const allJobs = [];

jsonFiles.forEach((file) => {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const jobName = path.basename(path.dirname(path.dirname(file)));

  const totalTests =
    (report.stats?.expected ?? 0) +
    (report.stats?.unexpected ?? 0) +
    (report.stats?.skipped ?? 0);

  console.log(
    `Processing ${jobName}: ${(report.stats?.expected ?? 0) + (report.stats?.unexpected ?? 0)} tests`,
  );

  const job = {
    job_id: jobName,
    job_name: jobName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    runner_os: 'ubuntu-latest',
    started_at: new Date(report.stats?.startTime ?? Date.now()).toISOString(),
    finished_at: new Date().toISOString(),
    status: (report.stats?.unexpected ?? 0) === 0 ? 'success' : 'failure',
    total_tests: totalTests,
    passed_tests: report.stats?.expected ?? 0,
    failed_tests: report.stats?.unexpected ?? 0,
    skipped_tests: report.stats?.skipped ?? 0,
    duration_ms: report.stats?.duration ?? 0,
    suites: [],
  };

  function extractTests(suite) {
    if (suite.specs) {
      suite.specs.forEach((spec) => {
        spec.tests.forEach((test) => {
          const result = test.results?.[0] ?? {};
          allTests.push({
            job_id: jobName,
            test_name: spec.title,
            suite_name: suite.title,
            file_path: spec.file,
            line_number: spec.line,
            labels: spec.tags || [],
            status: mapStatus(result.status),
            duration_ms: result.duration || 0,
            started_at: new Date(result.startTime || Date.now()).toISOString(),
            error_message: result.error?.message || null,
            error_log: result.error?.stack || null,
            retry_count: Math.max(0, (test.results?.length ?? 1) - 1),
          });
        });
      });
    }
    if (suite.suites) {
      suite.suites.forEach(extractTests);
    }
  }

  (report.suites || []).forEach(extractTests);
  allJobs.push(job);
});

function mapStatus(status) {
  const mapping = {
    passed: 'passed',
    failed: 'failed',
    timedOut: 'failed',
    skipped: 'skipped',
    interrupted: 'skipped',
  };
  return mapping[status] || 'skipped';
}

const payload = {
  pipeline: {
    pipeline_id: process.env.GITHUB_RUN_ID,
    pipeline_name: process.env.GITHUB_WORKFLOW,
    pipeline_url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.GITHUB_REF_NAME || 'main',
    commit_sha: process.env.GITHUB_SHA,
    triggered_by: process.env.GITHUB_EVENT_NAME || 'push',
    started_at: allJobs.length > 0 ? allJobs[0].started_at : new Date().toISOString(),
    finished_at: new Date().toISOString(),
    status: allJobs.length > 0 && allJobs.every((j) => j.status === 'success') ? 'success' : 'failure',
  },
  jobs: allJobs,
  tests: allTests,
};

fs.writeFileSync('test-results-payload.json', JSON.stringify(payload, null, 2));
console.log('\nPayload saved to test-results-payload.json');
console.log(`   Jobs: ${allJobs.length}`);
console.log(`   Tests: ${allTests.length}`);
console.log(`   Passed: ${allTests.filter((t) => t.status === 'passed').length}`);
console.log(`   Failed: ${allTests.filter((t) => t.status === 'failed').length}`);
console.log(`   Skipped: ${allTests.filter((t) => t.status === 'skipped').length}`);
