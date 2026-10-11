/*
 * The shape every budget script shares: a warm-up at half the rate that is not measured,
 * then the measured phase at a constant arrival rate. Requests carry the phase as a tag and
 * the thresholds read only `phase:measure`, so cold caches and JIT warm-up do not count.
 *
 *   RATE      requests (iterations) per second in the measured phase
 *   DURATION  length of the measured phase (default 2m)
 *   WARMUP    length of the warm-up (default 20s; 0s skips it)
 *
 * Alongside runs `floor` (2/s GET /healthz): every script that uses this exports it.
 */
import { BASE_THRESHOLDS, ENDPOINT_BUDGETS, SUMMARY_TREND_STATS } from './budgets.js';

export function budgetOptions({ rate, endpoints, extraThresholds = {}, maxVUs = 100 }) {
  const measuredRate = Number(__ENV.RATE || rate);
  const duration = __ENV.DURATION || '2m';
  const warmup = __ENV.WARMUP || '20s';
  const warm = warmup !== '0s' && warmup !== '0';
  const scenario = (phase, iterations, length, startTime) => ({
    executor: 'constant-arrival-rate',
    rate: iterations,
    timeUnit: '1s',
    duration: length,
    startTime,
    preAllocatedVUs: Math.min(maxVUs, Math.max(4, iterations * 2)),
    maxVUs,
    tags: { phase },
  });
  const scenarios = { measure: scenario('measure', measuredRate, duration, warm ? warmup : '0s') };
  if (warm)
    scenarios.warmup = scenario('warmup', Math.max(1, Math.ceil(measuredRate / 2)), warmup, '0s');
  scenarios.floor = {
    ...scenario('measure', 2, duration, warm ? warmup : '0s'),
    exec: 'floor',
    maxVUs: 4,
  };
  return {
    scenarios,
    summaryTrendStats: SUMMARY_TREND_STATS,
    thresholds: {
      'http_req_failed{phase:measure}': BASE_THRESHOLDS.http_req_failed,
      'checks{phase:measure}': BASE_THRESHOLDS.checks,
      'http_req_duration{endpoint:network_floor}': ['max>=0'],
      ...Object.fromEntries(
        endpoints.map((endpoint) => [
          `http_req_duration{endpoint:${endpoint},phase:measure}`,
          ENDPOINT_BUDGETS[endpoint] === undefined
            ? ['max>=0']
            : [`p(95)<${ENDPOINT_BUDGETS[endpoint]}`],
        ]),
      ),
      ...extraThresholds,
    },
  };
}

/** Picks a key from { key: weight } in proportion to the weights. */
export function weighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return () => {
    let roll = Math.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries[entries.length - 1][0];
  };
}
