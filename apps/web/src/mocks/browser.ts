import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { WebSocketInterceptor } from '@mswjs/interceptors/WebSocket';
import { defineNetwork, InterceptorSource } from 'msw/experimental';
import { MOCK_SCENARIOS, type MockDb, type MockScenario } from './db.ts';
import { createMockApi } from './dispatch.ts';
import { mswHandlers } from './msw.ts';

const STORAGE_KEY = 'bemmoly.mock-db';
const REAL_KEY = 'bemmoly.mock-real';

function isScenario(value: string | null): value is MockScenario {
  return MOCK_SCENARIOS.includes(value as MockScenario);
}

function load(): MockDb | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw && raw !== 'off' ? (JSON.parse(raw) as MockDb) : null;
  } catch {
    return null;
  }
}

/**
 * Development only. Routes the server has not grown yet are answered by the
 * in-memory mock backend; real routes always win. `?mock=fresh|wizard|ready|
 * signed-out|member` resets the mock to a scenario; `?mock=off` disables it.
 *
 * MSW intercepts fetch and WebSocket inside the page rather than through a
 * service worker: every API call is made by this page, and some embedded
 * browsers refuse to register service workers.
 */
export async function startDevMocks(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('mock');
  if (requested === 'off') sessionStorage.setItem(STORAGE_KEY, 'off');
  if (sessionStorage.getItem(STORAGE_KEY) === 'off' && !isScenario(requested)) return;
  /** `?real=off` answers everything from the mock, for checking screens against the design. */
  if (params.has('real')) sessionStorage.setItem(REAL_KEY, params.get('real') ?? 'on');
  const fallback = sessionStorage.getItem(REAL_KEY) !== 'off';
  const api = createMockApi(isScenario(requested) ? requested : (load() ?? 'ready'));
  const save = () => sessionStorage.setItem(STORAGE_KEY, JSON.stringify(api.db));
  save();
  const network = defineNetwork({
    sources: [
      new InterceptorSource({
        interceptors: [new FetchInterceptor(), new WebSocketInterceptor()] as never,
      }),
    ],
    handlers: mswHandlers(api, { fallback, onChange: save }),
    onUnhandledFrame: 'bypass',
  });
  await network.enable();
}
