/*
 * §20: page open (collab connect + snapshot), p95 under 150 ms. One iteration opens a seeded
 * page as the editor does: the page's REST detail, then /collab with the session cookie,
 * authenticate, sync step 1, and the snapshot back.
 *
 *   k6 run -e BASE_URL=… -e CREDENTIALS=… -e DATASET=… perf/k6/docs-page.js   (RATE default 5/s)
 */
import { pageDetail } from './lib/actions.js';
import { BUDGETS_MS } from './lib/budgets.js';
import { collabErrorThresholds, openPage } from './lib/collab.js';
import { pageIds, personForIteration, pickFrom } from './lib/config.js';
import { budgetOptions } from './lib/scenarios.js';

export { floor } from './lib/actions.js';

export const options = budgetOptions({
  rate: 5,
  endpoints: ['page_detail'],
  extraThresholds: {
    'collab_page_open{phase:measure}': [`p(95)<${BUDGETS_MS.pageOpen}`],
    ...collabErrorThresholds(),
  },
});

export default function () {
  const person = personForIteration();
  const pageId = pickFrom(pageIds);
  pageDetail(person, pageId);
  openPage(person, pageId, { closeWhenSynced: true });
}
