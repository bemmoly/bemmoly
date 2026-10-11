/*
 * How the screens hold up as the data grows: the mixed workload in the background at a
 * moderate rate, and a probe that opens the largest Scrum board (its active sprint), the
 * largest Kanban board (every unfinished issue), an issue, ⌘K, a page over /collab, the largest
 * space's page tree and Docs search, each tagged so the
 * results report them apart. Run it after each step of perf/src/grow.ts.
 *
 *   RATE (background actions a second, default 40), PROBE_RATE (probes a second, default 2),
 *   DURATION (default 5m)
 */
import { boardOf, issueDetail, pageDetail, paletteKeystroke } from './lib/actions.js';
import { BUDGETS_MS, SUMMARY_TREND_STATS } from './lib/budgets.js';
import { collabErrorThresholds, openPage } from './lib/collab.js';
import { check } from 'k6';
import http from 'k6/http';
import { API, authHeaders, dataset, pageIds, personForIteration, pickFrom } from './lib/config.js';
import { workloadOptions } from './lib/workload.js';

export { apiAction } from './lib/workload.js';

const largest = (method) =>
  dataset.projects.filter((p) => p.method === method).sort((a, b) => b.issues - a.issues)[0];
const scrum = largest('scrum');
const kanban = largest('kanban');

const largestSpace = dataset.spaces[dataset.spaces.length - 1];

/** The docs side: a space's page tree and Docs search, the two that grow with page count. */
function docsGet(person, path, endpoint) {
  const response = http.get(`${API}${path}`, authHeaders(person, { tags: { endpoint } }));
  check(response, { [`${endpoint} answers 2xx`]: (r) => r.status >= 200 && r.status < 300 });
}

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
    'http_req_duration{endpoint:page_tree}': [`p(95)<${BUDGETS_MS.pageOpen}`],
    'http_req_duration{endpoint:docs_search}': [`p(95)<${BUDGETS_MS.searchAutocomplete}`],
    ...collabErrorThresholds(),
  },
};

const PROBES = ['scrum', 'kanban', 'issue', 'palette', 'page', 'tree', 'docs_search'];

export function probe() {
  const person = personForIteration();
  const which = PROBES[Math.floor(Math.random() * PROBES.length)];
  if (which === 'scrum' && scrum) boardOf(person, scrum, 'board_scrum');
  else if (which === 'kanban' && kanban) boardOf(person, kanban, 'board_kanban');
  else if (which === 'issue') issueDetail(person);
  else if (which === 'palette') paletteKeystroke(person, pickFrom(dataset.searchTerms));
  else if (which === 'tree')
    docsGet(person, `/docs/spaces/${largestSpace.key}/tree?limit=50`, 'page_tree');
  else if (which === 'docs_search') {
    docsGet(
      person,
      `/docs/search?q=${encodeURIComponent(pickFrom(dataset.searchTerms))}`,
      'docs_search',
    );
  } else {
    const pageId = pickFrom(pageIds);
    pageDetail(person, pageId);
    openPage(person, pageId, { closeWhenSynced: true });
  }
}
