import { FlakySimulator } from './flaky-simulator';

export default async function globalSetup(): Promise<void> {
  if (process.env.ENABLE_FLAKY === 'true') {
    const simulator = FlakySimulator.getInstance();
    simulator.initialize({
      enabled: true,
      minFailures: parseInt(process.env.FLAKY_MIN || '0', 10),
      maxFailures: parseInt(process.env.FLAKY_MAX || '20', 10),
      failureTypes: [
        'timeout',
        'element_not_found',
        'network_error',
        'assertion_mismatch',
        'intercepted_request',
        'random_delay',
      ],
    });
  }
}
