/*
 * How the screens hold up as the data grows: the mixed workload in the background at a
 * moderate rate, and a probe that opens the largest Scrum board (its active sprint), the
 * largest Kanban board (every unfinished issue), an issue, ⌘K and a page, each tagged so the
 * results report them apart. Run it after each step of perf/src/grow.ts.
 *
 *   RATE (background actions a second, default 40), PROBE_RATE (probes a second, default 2),
 *   DURATION (default 5m)
 */
import { boardOf, issueDetail, pageDetail, paletteKeystroke } from './lib/actions.js';
import { BUDGETS_MS, SUMMARY_TREND_STATS } from './lib/budgets.js';
import { collabErrorThresholds, openPage } from './lib/collab.js';
import { dataset, pageIds, personForIteration, pickFrom } from './lib/config.js';
import { workloadOptions } from './lib/workload.js';

export { apiAction } from './lib/workload.js';

const largest = (method) =>
  dataset.projects.filter((p) => p.method === method).sort((a, b) => b.issues - a.issues)[0];
const scrum = largest('scrum');
const kanban = largest('kanban');

const background = workloadOptions({ duration: '5m', rate: 40, pageRate: 0, pairs: 0 });
const duration = __ENV.DURATION || '5m';

export const options = {
  scenarios: {
    api: background.scenarios.api,
    probe: {
      executor: 'constant-arrival-rate',
      exec: 'probe',
      rate: Number(__ENV.PROBE_RATE || 2),
      timeUnit: '1s',
      duration,
      preAllocatedVUs: 10,
      maxVUs: 60,
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: {
    ...background.thresholds,
    'http_req_duration{endpoint:board_scrum}': [`p(95)<${BUDGETS_MS.boardView}`],
    'http_req_duration{endpoint:board_kanban}': [`p(95)<${BUDGETS_MS.boardView}`],
    collab_page_open: [`p(95)<${BUDGETS_MS.pageOpen}`],
    ...collabErrorThresholds(),
  },
};

const PROBES = ['scrum', 'kanban', 'issue', 'palette', 'page'];

export function probe() {
  const person = personForIteration();
  const which = PROBES[Math.floor(Math.random() * PROBES.length)];
  if (which === 'scrum' && scrum) boardOf(person, scrum, 'board_scrum');
  else if (which === 'kanban' && kanban) boardOf(person, kanban, 'board_kanban');
  else if (which === 'issue') issueDetail(person);
  else if (which === 'palette') paletteKeystroke(person, pickFrom(dataset.searchTerms));
  else {
    const pageId = pickFrom(pageIds);
    pageDetail(person, pageId);
    openPage(person, pageId, { closeWhenSynced: true });
  }
}
