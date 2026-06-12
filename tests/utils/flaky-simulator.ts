import { expect, Page } from '@playwright/test';
import { readFlakyPlan, writeFlakyPlan } from './flaky-plan-store';

export type FailureType =
  | 'timeout'
  | 'element_not_found'
  | 'network_error'
  | 'assertion_mismatch'
  | 'intercepted_request'
  | 'random_delay';

export interface FlakyConfig {
  enabled: boolean;
  minFailures: number;
  maxFailures: number;
  failureTypes: FailureType[];
}

/** All 50 test case IDs used for failure planning */
const ALL_TEST_IDS = Array.from({ length: 50 }, (_, i) =>
  `TC-BS-${String(i + 1).padStart(3, '0')}`,
);

/**
 * Singleton flaky test simulator.
 * Plans 0–20 random failures per run (deterministic within a run, random across runs).
 */
export class FlakySimulator {
  private static instance: FlakySimulator;

  private config: FlakyConfig | null = null;
  private failurePlans = new Map<string, FailureType>();
  private initialized = false;
  private seed = 0;

  private constructor() {}

  static getInstance(): FlakySimulator {
    if (!FlakySimulator.instance) {
      FlakySimulator.instance = new FlakySimulator();
    }
    return FlakySimulator.instance;
  }

  /** Reset singleton state (useful for testing the simulator itself) */
  static reset(): void {
    FlakySimulator.instance = new FlakySimulator();
  }

  initialize(config: FlakyConfig): void {
    this.config = config;
    this.seed = Date.now();
    this.failurePlans.clear();
    const failureCount = this.planFailures();
    this.initialized = true;
    this.persistPlan(failureCount);
  }

  /** Load plan written by globalSetup into this worker process */
  hydrateFromDisk(): void {
    if (this.initialized) {
      return;
    }

    const planFile = readFlakyPlan();
    if (!planFile?.enabled) {
      return;
    }

    this.config = {
      enabled: true,
      minFailures: planFile.minFailures,
      maxFailures: planFile.maxFailures,
      failureTypes: [
        'timeout',
        'element_not_found',
        'network_error',
        'assertion_mismatch',
        'intercepted_request',
        'random_delay',
      ],
    };
    this.failurePlans = new Map(Object.entries(planFile.plans));
    this.initialized = true;
  }

  isEnabled(): boolean {
    return this.config?.enabled === true;
  }

  getFailurePlans(): ReadonlyMap<string, FailureType> {
    return this.failurePlans;
  }

  /**
   * Inject a planned failure for the given test ID, if one was scheduled.
   * Call at the start of every test before real test logic.
   */
  async maybeInjectFailure(testId: string, page: Page): Promise<void> {
    this.hydrateFromDisk();

    if (!this.config?.enabled || !this.initialized) {
      return;
    }

    const failureType = this.failurePlans.get(testId);
    if (!failureType) {
      return;
    }

    await this.injectFailure(failureType, page, testId);
  }

  private planFailures(): number {
    if (!this.config?.enabled) {
      return 0;
    }

    const { minFailures, maxFailures, failureTypes } = this.config;
    const failureCount = this.randomInt(
      Math.max(0, minFailures),
      Math.max(minFailures, maxFailures),
    );

    const shuffled = this.shuffle([...ALL_TEST_IDS]);
    const selectedTests = shuffled.slice(0, Math.min(failureCount, shuffled.length));

    for (const testId of selectedTests) {
      const failureType = failureTypes[this.randomInt(0, failureTypes.length - 1)];
      this.failurePlans.set(testId, failureType);
    }

    this.logFailurePlan(failureCount);
    return failureCount;
  }

  private persistPlan(failureCount: number): void {
    if (!this.config?.enabled) {
      return;
    }

    writeFlakyPlan({
      enabled: true,
      minFailures: this.config.minFailures,
      maxFailures: this.config.maxFailures,
      failureCount,
      plans: Object.fromEntries(this.failurePlans),
    });
  }

  private logFailurePlan(failureCount: number): void {
    if (this.failurePlans.size === 0) {
      console.log('[FlakySimulator] This run will inject 0 failures.');
      return;
    }

    console.log(`[FlakySimulator] This run will inject ${failureCount} failure(s):`);
    for (const [testId, failureType] of this.failurePlans) {
      console.log(`  - ${testId}: ${failureType}`);
    }
  }

  private async injectFailure(
    failureType: FailureType,
    page: Page,
    testId: string,
  ): Promise<void> {
    switch (failureType) {
      case 'timeout':
        await page
          .locator(`[data-flaky-timeout="${testId}"]`)
          .waitFor({ state: 'visible', timeout: 5000 });
        break;

      case 'element_not_found':
        await page
          .locator(`[data-flaky-missing="${testId}"]`)
          .click({ timeout: 5000 });
        break;

      case 'network_error':
        await page.route('**/*', (route) => route.abort('failed'));
        break;

      case 'assertion_mismatch':
        expect(
          false,
          `[FlakySimulator] Injected assertion_mismatch for ${testId}`,
        ).toBe(true);
        break;

      case 'intercepted_request':
        await page.route('**/*', async (route) => {
          await route.fulfill({
            status: 500,
            contentType: 'text/plain',
            body: `[FlakySimulator] Intercepted request for ${testId}`,
          });
        });
        break;

      case 'random_delay':
        await page.route('**/*', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 25000));
          await route.continue();
        });
        break;

      default:
        throw new Error(`[FlakySimulator] Unknown failure type: ${failureType}`);
    }
  }

  /** Seeded PRNG — deterministic within a single test run */
  private nextRandom(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.nextRandom() * (max - min + 1)) + min;
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
