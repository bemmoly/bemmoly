/*
 * The rules a capacity ramp is judged by, and how a rate of actions becomes people.
 *
 * Users: an active person makes about 0.2 requests a second (one action every 5 seconds, once
 * page loads and realtime refetches are counted), and a fifth of an organisation is active at
 * the same moment. Both are assumptions, the same ones the site publishes.
 */

export const REQUESTS_PER_ACTIVE_USER_PER_SECOND = 0.2;
export const ACTIVE_SHARE = 0.2;

export const activeUsers = (actionsPerSecond: number) =>
  Math.round(actionsPerSecond / REQUESTS_PER_ACTIVE_USER_PER_SECOND);
export const companySize = (actionsPerSecond: number) =>
  Math.round(activeUsers(actionsPerSecond) / ACTIVE_SHARE);

/** §20's budgets for the routes the mixed workload drives, server side, p95 in ms. */
export const ROUTE_BUDGETS_MS: Record<string, number> = {
  'GET /api/v1/work/boards/:id/view': 80,
  'GET /api/v1/work/issues/:key': 40,
  'GET /api/v1/work/search/suggest': 100,
  'GET /api/v1/search': 100,
  'GET /api/v1/work/search': 100,
  'GET /api/v1/docs/pages/:pageId': 150,
};
export const PAGE_OPEN_BUDGET_MS = 150;

/** Inside budget needs errors under this; a step breaks at ERROR_BREAK or BREAK_FACTOR × budget. */
export const ERROR_WITHIN = 0.001;
export const ERROR_BREAK = 0.01;
export const BREAK_FACTOR = 4;

export interface StepRoute {
  route: string;
  count: number;
  p95: number | null;
  p99: number | null;
}

export interface StepMeasure {
  errorRate: number;
  routes: StepRoute[];
  collabPageOpenP95: number | null;
}

export type Verdict = 'within' | 'degraded' | 'broken';

export function stepVerdict(step: StepMeasure): Verdict {
  const ratios = step.routes
    .filter((r) => ROUTE_BUDGETS_MS[r.route] !== undefined && r.p95 !== null)
    .map((r) => (r.p95 as number) / (ROUTE_BUDGETS_MS[r.route] as number));
  if (step.collabPageOpenP95 !== null) ratios.push(step.collabPageOpenP95 / PAGE_OPEN_BUDGET_MS);
  const worst = Math.max(0, ...ratios);
  if (step.errorRate >= ERROR_BREAK || worst > BREAK_FACTOR) return 'broken';
  if (step.errorRate >= ERROR_WITHIN || worst >= 1) return 'degraded';
  return 'within';
}
