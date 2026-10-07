// Nightly load test against the API budgets of tech design §20, run by
// .github/workflows/nightly.yml:
//
//   k6 run -e BASE_URL=http://127.0.0.1:8080 tools/k6/budgets.js
//
// Budgets (p95, measured on the 2 vCPU reference VM):
//   board view, 500 issues   GET /api/v1/projects/{key}/board          < 80 ms
//   issue detail             GET /api/v1/issues/{key}                  < 40 ms
//   search autocomplete      GET /api/v1/search/autocomplete?q={text}  < 100 ms
//
// Those endpoints arrive with the Work module. Until then the script measures the
// endpoints that exist, each held to the budget of the class it stands in for: /healthz
// is a single small read (issue detail), /api/v1/modules a list read (board view). When
// an endpoint ships, add it to ENDPOINTS with its budget and the sample dataset's ids.

import { check } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const DURATION = __ENV.DURATION || '1m';
const RATE = Number(__ENV.RATE || 50);

export const BUDGETS_MS = { boardView: 80, issueDetail: 40, searchAutocomplete: 100 };

const ENDPOINTS = [
  { name: 'healthz', path: '/healthz', budget: BUDGETS_MS.issueDetail },
  { name: 'modules', path: '/api/v1/modules', budget: BUDGETS_MS.boardView },
];

export const options = {
  scenarios: Object.fromEntries(
    ENDPOINTS.map((endpoint) => [
      endpoint.name,
      {
        executor: 'constant-arrival-rate',
        rate: RATE,
        timeUnit: '1s',
        duration: DURATION,
        preAllocatedVUs: 20,
        maxVUs: 100,
        exec: 'request',
        env: { ENDPOINT: endpoint.name },
      },
    ]),
  ),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    ...Object.fromEntries(
      ENDPOINTS.map((endpoint) => [
        `http_req_duration{endpoint:${endpoint.name}}`,
        [`p(95)<${endpoint.budget}`],
      ]),
    ),
  },
};

export function request() {
  const endpoint = ENDPOINTS.find((candidate) => candidate.name === __ENV.ENDPOINT);
  const response = http.get(`${BASE_URL}${endpoint.path}`, { tags: { endpoint: endpoint.name } });
  check(response, { 'answers 200': (r) => r.status === 200 });
}
