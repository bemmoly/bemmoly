import { createMockDb, type MockDb, type MockScenario } from './db.ts';
import { ROUTES } from './routes/index.ts';
import { fail, type MockResponse, type MockRoute } from './types.ts';

interface CompiledRoute {
  route: MockRoute;
  regex: RegExp;
  names: string[];
}

const compiled: CompiledRoute[] = ROUTES.map((route) => {
  const names: string[] = [];
  const source = route.pattern.replace(/:([a-zA-Z]+)/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { route, regex: new RegExp(`^${source}$`), names };
});

export function matchRoute(method: string, path: string) {
  for (const entry of compiled) {
    if (entry.route.method !== method) continue;
    const match = entry.regex.exec(path);
    if (!match) continue;
    const params = Object.fromEntries(
      entry.names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? '')]),
    );
    return { route: entry.route, params };
  }
  return null;
}

export interface MockApi {
  db: MockDb;
  /** Answers like the server would, or null when no mock covers the route. */
  dispatch(method: string, url: string, body: unknown): MockResponse | null;
  reset(scenario: MockScenario): void;
}

/**
 * The in-memory backend behind MSW (dev, unit tests) and Playwright's
 * page.route (e2e). One implementation, so all three agree.
 */
export function createMockApi(initial: MockDb | MockScenario = 'ready'): MockApi {
  const api: MockApi = {
    db: typeof initial === 'string' ? createMockDb(initial) : initial,
    dispatch(method, url, body) {
      const parsed = new URL(url, 'http://mock.local');
      const found = matchRoute(method.toUpperCase(), parsed.pathname);
      if (!found) return null;
      if (!found.route.anonymous && !api.db.signedInAs) {
        return fail(401, 'unauthenticated', 'Sign in to continue.');
      }
      return found.route.handle(
        { method, path: parsed.pathname, query: parsed.searchParams, body, params: found.params },
        api.db,
      );
    },
    reset(scenario) {
      api.db = createMockDb(scenario);
    },
  };
  return api;
}
