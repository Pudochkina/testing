import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/specs',
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['html', {
      open: 'never',
      outputFolder: 'playwright-report',
    }],
    ['json', {
      outputFile: 'test-results/results.json',
    }],
  ],

  use: {
    baseURL: 'https://demoqa.com',

    // CRITICAL: Trace & Screenshot on failure
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 15000,
    navigationTimeout: 30000,

    viewport: { width: 1920, height: 1080 },

    testIdAttribute: 'data-testid',
  },

  outputDir: 'test-results/',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './tests/utils/flaky-setup.ts',
  globalTeardown: './tests/utils/flaky-teardown.ts',
});
