/*
 * A realistic day on the install, compressed: reads dominate, people open boards, issues and
 * pages, type into ⌘K, edit and comment, while a few pairs write a page together. Shared by
 * mixed.js (minutes, every budget held) and soak.js (hours, watched for drift).
 *
 *   RATE        API actions per second (default 40: 200 people at one action every 5 s)
 *   PAGE_RATE   page opens over /collab per second (default 1)
 *   PAIRS       pairs typing together (default 3)
 *   DURATION    how long (mixed: 10m, soak: 24h)
 */
import exec from 'k6/execution';
import {
  boardView,
  commentCreate,
  issueCreate,
  issueDetail,
  issueSearch,
  issueUpdate,
  pageDetail,
  paletteKeystroke,
} from './actions.js';
import { BASE_THRESHOLDS, BUDGETS_MS, ENDPOINT_BUDGETS, SUMMARY_TREND_STATS } from './budgets.js';
import { openPage, typeTogether } from './collab.js';
import { dataset, pageIds, pairForVu, personForIteration, pickFrom } from './config.js';
import { weighted } from './scenarios.js';

const WEIGHTS = {
  issue_detail: 30,
  search_suggest: 20,
  page_detail: 14,
  board_view: 12,
  issue_update: 10,
  comment_create: 6,
  issue_search: 4,
  issue_create: 4,
};

const ACTIONS = {
  issue_detail: (person) => issueDetail(person),
  search_suggest: (person) => paletteKeystroke(person, pickFrom(dataset.searchTerms)),
  page_detail: (person) => pageDetail(person),
  board_view: (person) => boardView(person),
  issue_update: (person) => issueUpdate(person),
  comment_create: (person) => commentCreate(person),
  issue_search: (person) => issueSearch(person),
  issue_create: (person) => issueCreate(person),
};

const nextAction = weighted(WEIGHTS);

export function workloadOptions(defaults) {
  const duration = __ENV.DURATION || defaults.duration;
  const rate = Number(__ENV.RATE || defaults.rate);
  const pageRate = Number(__ENV.PAGE_RATE || defaults.pageRate);
  const pairs = Number(__ENV.PAIRS || defaults.pairs);
  const scenarios = {
    api: {
      executor: 'constant-arrival-rate',
      exec: 'apiAction',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.max(10, rate),
      maxVUs: Math.max(50, rate * 4),
    },
    pages: {
      executor: 'constant-arrival-rate',
      exec: 'pageOpenAction',
      rate: Math.max(1, Math.round(pageRate * 60)),
      timeUnit: '1m',
      duration,
      preAllocatedVUs: 4,
      maxVUs: 20,
    },
  };
  if (pairs > 0) {
    scenarios.collab = {
      executor: 'constant-vus',
      exec: 'collabAction',
      vus: pairs,
      duration,
      gracefulStop: '45s',
    };
  }
  const endpoints = [...Object.keys(WEIGHTS), 'palette_search'];
  return {
    scenarios,
    summaryTrendStats: SUMMARY_TREND_STATS,
    thresholds: {
      ...BASE_THRESHOLDS,
      ...Object.fromEntries(
        endpoints.map((endpoint) => [
          `http_req_duration{endpoint:${endpoint}}`,
          ENDPOINT_BUDGETS[endpoint] === undefined
            ? ['max>=0']
            : [`p(95)<${ENDPOINT_BUDGETS[endpoint]}`],
        ]),
      ),
      collab_page_open: [`p(95)<${BUDGETS_MS.pageOpen}`],
      ...(pairs > 0
        ? { collab_delivered: ['rate>0.999'], collab_remote_echo: [`p(95)<${BUDGETS_MS.pageOpen}`] }
        : {}),
      collab_errors: ['count<1'],
    },
  };
}

export function apiAction() {
  ACTIONS[nextAction()](personForIteration());
}

export function pageOpenAction() {
  const person = personForIteration();
  const pageId = pickFrom(pageIds);
  pageDetail(person, pageId);
  openPage(person, pageId, { closeWhenSynced: true });
}

export function collabAction() {
  // Pages from the end of the list, so pairs and page opens rarely share a document.
  const pageId = pageIds[pageIds.length - 1 - ((exec.vu.idInTest - 1) % pageIds.length)];
  typeTogether(pairForVu(), pageId, { seconds: 30, keyMs: 150 });
}
