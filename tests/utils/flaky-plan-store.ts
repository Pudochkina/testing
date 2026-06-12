import fs from 'fs';
import path from 'path';
import { FailureType } from './flaky-simulator';

export interface FlakyPlanFile {
  enabled: boolean;
  minFailures: number;
  maxFailures: number;
  failureCount: number;
  plans: Record<string, FailureType>;
}

const PLAN_FILE = path.join(process.cwd(), 'test-results', 'flaky-plan.json');

export function writeFlakyPlan(plan: FlakyPlanFile): void {
  fs.mkdirSync(path.dirname(PLAN_FILE), { recursive: true });
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf8');
}

export function readFlakyPlan(): FlakyPlanFile | null {
  if (!fs.existsSync(PLAN_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8')) as FlakyPlanFile;
  } catch {
    return null;
  }
}

export function clearFlakyPlan(): void {
  if (fs.existsSync(PLAN_FILE)) {
    fs.unlinkSync(PLAN_FILE);
  }
}
