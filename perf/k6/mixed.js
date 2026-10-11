/*
 * The mixed realistic workload: 200 people's day compressed into minutes, with every §20
 * budget held at once (see lib/workload.js for the mix and its knobs).
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/mixed.js   (10m at 40 actions/s)
 */
import { workloadOptions } from './lib/workload.js';

export { apiAction, collabAction, pageOpenAction } from './lib/workload.js';

export const options = workloadOptions({ duration: '10m', rate: 40, pageRate: 1, pairs: 3 });
