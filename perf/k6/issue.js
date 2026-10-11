/*
 * §20: issue detail API, p95 under 40 ms. The issue page's first request, over every seeded
 * issue in all three projects.
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/issue.js   (RATE default 30/s)
 */
import { issueDetail } from './lib/actions.js';
import { personForIteration } from './lib/config.js';
import { budgetOptions } from './lib/scenarios.js';

export { floor } from './lib/actions.js';

export const options = budgetOptions({ rate: 30, endpoints: ['issue_detail'] });

export default function () {
  issueDetail(personForIteration());
}
