import { cleanup, configure } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { createMockApi } from '../mocks/dispatch.ts';
import { mswHandlers } from '../mocks/msw.ts';
import { loadLaterIcons } from '@bemmoly/ui/icons';

/**
 * Every unit test talks to the same in-memory backend the dev server and
 * Playwright use, through MSW. Each test starts from the "ready" scenario;
 * `mockApi.reset('fresh')` switches it.
 */
export const mockApi = createMockApi('ready');
const server = setupServer(...mswHandlers(mockApi, { fallback: false }));

/** Relative API paths resolve against this origin under happy-dom. */
const ORIGIN = 'http://bemmoly.test';

beforeAll(() => {
  window.happyDOM?.setURL(`${ORIGIN}/`);
  server.listen({ onUnhandledFrame: 'bypass' });
});
beforeEach(() => mockApi.reset('ready'));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

declare global {
  interface Window {
    happyDOM?: { setURL(url: string): void };
  }
}

// Draw every icon from the first render: the app loads the later ones once it is idle.
await loadLaterIcons();

// The first render in a file loads its screen's chunks (and the logo's and icons' own, read on
// first use); on a loaded CI runner that can pass Testing Library's 1 s default.
configure({ asyncUtilTimeout: 5_000 });
