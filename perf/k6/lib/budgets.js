/*
 * The budgets of tech design §20, in milliseconds at p95 on the 2 vCPU reference VM. Each
 * script turns the ones it measures into k6 thresholds, so a run over budget exits non-zero.
 *
 * §20 names three API budgets and the page open; the other endpoints the scripts drive are
 * held to the budget of the class they belong to, and say so:
 *   ⌘K (GET /search, every module's provider) and full issue search: search autocomplete
 *   page detail (GET /docs/pages/:id), the REST half of a page open: page open
 *   collab keystroke echo: no §20 budget; held to the page open as the nearest one
 *   writes (issue update, comment): no §20 budget; reported, held only to the error rate
 */
export const BUDGETS_MS = {
  boardView: 80,
  issueDetail: 40,
  searchAutocomplete: 100,
  pageOpen: 150,
};

/** Every scenario also holds to these: under 1% failed requests and checks. */
export const BASE_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
};

/** The endpoint tag each request carries, and the budget its p95 is held to. */
export const ENDPOINT_BUDGETS = {
  board_view: BUDGETS_MS.boardView,
  issue_detail: BUDGETS_MS.issueDetail,
  search_suggest: BUDGETS_MS.searchAutocomplete,
  palette_search: BUDGETS_MS.searchAutocomplete,
  issue_search: BUDGETS_MS.searchAutocomplete,
  page_detail: BUDGETS_MS.pageOpen,
};

/**
 * Thresholds for the given endpoint tags: p95 under budget where §20 has one. An endpoint
 * without a budget gets a threshold that always holds, which is how k6 puts a tagged
 * sub-metric in the summary at all.
 */
export function endpointThresholds(endpoints) {
  return Object.fromEntries(
    endpoints.map((endpoint) => [
      `http_req_duration{endpoint:${endpoint}}`,
      ENDPOINT_BUDGETS[endpoint] === undefined
        ? ['max>=0']
        : [`p(95)<${ENDPOINT_BUDGETS[endpoint]}`],
    ]),
  );
}

/** p50, p95 and p99 in the end-of-test summary, which the results table is built from. */
export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max', 'count'];
