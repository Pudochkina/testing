import { clearFlakyPlan } from './flaky-plan-store';

export default async function globalTeardown(): Promise<void> {
  clearFlakyPlan();
}
