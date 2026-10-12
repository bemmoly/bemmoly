import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tintLevel } from './model.ts';
import PairingScreen from './pairing-screen.tsx';

/*
 * The Pairing view against a mock backend: three people, two pairs, one never paired, and the
 * range and open pair carried in the address.
 */

const id = (n: number) => `018f0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const AISHA = id(1);
const ROHAN = id(2);
const LENA = id(3);

const PROJECT = {
  id: id(50),
  key: 'PLT',
  name: 'Platform Core',
  description: null,
  teamId: null,
  method: 'scrum',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const MATRIX = {
  from: '2026-07-15',
  to: '2026-10-12',
  people: [
    { id: AISHA, name: 'Aisha K.', issues: 5 },
    { id: ROHAN, name: 'Rohan S.', issues: 3 },
    { id: LENA, name: 'Lena T.', issues: 1 },
  ],
  cells: [
    {
      a: AISHA,
      b: ROHAN,
      count: 3,
      hours: 12.5,
      lastPairedAt: '2026-10-10T12:00:00.000Z',
      issues: [{ key: 'PLT-204', title: 'Session store migration' }],
    },
    {
      a: AISHA,
      b: LENA,
      count: 1,
      hours: 2,
      lastPairedAt: '2026-09-01T12:00:00.000Z',
      issues: [{ key: 'PLT-150', title: 'Billing v2' }],
    },
  ],
};

let queries: string[] = [];
let people = MATRIX.people;
let suggestions: unknown[] | undefined;

const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({ items: [PROJECT], nextCursor: null }),
  ),
  http.get('*/api/v1/work/projects/PLT/pairing', ({ request }) => {
    queries.push(new URL(request.url).search);
    return HttpResponse.json(
      people.length ? { ...MATRIX, suggestions } : { ...MATRIX, people: [], cells: [] },
    );
  }),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
  http.get('*/api/v1/work/issues/:key', () => HttpResponse.json({}, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  queries = [];
  people = MATRIX.people;
  suggestions = undefined;
  window.history.replaceState(null, '', '/work/pairing/PLT');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderPairing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PairingScreen projectKey="PLT" rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('Pairing screen', () => {
  it('draws a cell per pair, says never for the rest, and moves between cells with arrows', async () => {
    renderPairing();
    expect(screen.getByRole('status', { name: 'Loading the pairing matrix' })).toBeTruthy();
    const busy = await screen.findByRole('button', {
      name: 'Aisha K. and Rohan S.: 3 shared issues',
    });
    expect(busy.textContent).toBe('3');
    expect(screen.getByRole('button', { name: 'Rohan S. and Lena T.: never paired' })).toBeTruthy();
    expect(queries[0]).toMatch(/^\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);

    // The first cell off the diagonal holds the one tab stop.
    expect(busy.tabIndex).toBe(0);
    fireEvent.keyDown(busy, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Aisha K. and Lena T.: 1 shared issue',
    );
  });

  it('opens the pair panel from a cell, in the address, and closes it with Escape', async () => {
    renderPairing();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Aisha K. and Rohan S.: 3 shared issues' }),
    );
    const panel = await screen.findByRole('region', { name: 'Aisha K. and Rohan S.' });
    expect(window.location.search).toBe(`?pair=${AISHA}%2C${ROHAN}`);
    expect(panel.textContent).toContain('3 shared issues, 12.5 hours together');
    expect(screen.getByRole('button', { name: /PLT-204/ })).toBeTruthy();
    fireEvent.keyDown(panel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('region', { name: /Rohan S\./ })).toBeNull());
  });

  it('lists suggested pairs only when the server sends them, each opening its pair', async () => {
    renderPairing();
    await screen.findByRole('button', { name: 'Aisha K. and Rohan S.: 3 shared issues' });
    expect(screen.queryByRole('heading', { name: 'Suggested pairs' })).toBeNull();
    cleanup();

    suggestions = [{ a: ROHAN, b: LENA, count: 0, lastPairedAt: null }];
    renderPairing();
    const heading = await screen.findByRole('heading', { name: 'Suggested pairs' });
    const list = within(heading.parentElement as HTMLElement);
    expect(list.getByRole('button').textContent).toContain('never paired');
    fireEvent.click(list.getByRole('button'));
    expect(await screen.findByRole('region', { name: 'Rohan S. and Lena T.' })).toBeTruthy();
  });

  it('offers the last year when nobody held an issue in the range', async () => {
    people = [];
    renderPairing();
    expect(await screen.findByText('Nobody held an issue in this range')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show the last year' }));
    await waitFor(() => expect(window.location.search).toBe('?range=365'));
  });
});

describe('tint levels', () => {
  it('splits the busiest pair in quarters and keeps never at zero', () => {
    expect([0, 1, 2, 3, 4, 8].map((count) => tintLevel(count, 8))).toEqual([0, 1, 1, 2, 2, 4]);
    expect(tintLevel(3, 0)).toBe(0);
  });
});
