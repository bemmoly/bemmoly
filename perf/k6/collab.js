/*
 * Two people typing into one page over /collab, a keystroke every 150 ms each, for 30 s a
 * session. Each virtual user drives one pair on its own seeded page. Every keystroke must
 * reach the other person; its trip there is held to the page-open budget, the nearest one
 * §20 has (there is no keystroke budget).
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/collab.js
 *   PAIRS (default 2), DURATION (default 2m), SESSION_SECONDS (default 30), KEY_MS (default 150)
 */
import exec from 'k6/execution';
import { BUDGETS_MS, SUMMARY_TREND_STATS } from './lib/budgets.js';
import { collabErrorThresholds, typeTogether } from './lib/collab.js';
import { pageIds, pairForVu } from './lib/config.js';

export const options = {
  scenarios: {
    pairs: {
      executor: 'constant-vus',
      vus: Number(__ENV.PAIRS || 2),
      duration: __ENV.DURATION || '2m',
      gracefulStop: '45s',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: {
    collab_delivered: ['rate>0.999'],
    collab_remote_echo: [`p(95)<${BUDGETS_MS.pageOpen}`],
    collab_page_open: [`p(95)<${BUDGETS_MS.pageOpen}`],
    ...collabErrorThresholds(),
  },
};

export default function () {
  const pageId = pageIds[(exec.vu.idInTest - 1) % pageIds.length];
  typeTogether(pairForVu(), pageId, {
    seconds: Number(__ENV.SESSION_SECONDS || 30),
    keyMs: Number(__ENV.KEY_MS || 150),
  });
}
