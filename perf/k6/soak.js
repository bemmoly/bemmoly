/*
 * The soak: the mixed workload held for hours at a steady rate, while perf/src/soak/monitor.ts
 * samples the server (memory, heap, database connections, queue depth, p95 per window and
 * error rate). The weekly run is 24 hours; DURATION shortens it.
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… -e DURATION=45m perf/k6/soak.js
 */
import { workloadOptions } from './lib/workload.js';

export { apiAction, collabAction, pageOpenAction } from './lib/workload.js';

export const options = workloadOptions({ duration: '24h', rate: 30, pageRate: 0.5, pairs: 2 });
