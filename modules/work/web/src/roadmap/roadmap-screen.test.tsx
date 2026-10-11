import { ToastProvider } from '@bemmoly/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IDS, roadmapView } from './fixtures.test-helper.ts';
import RoadmapScreen from './roadmap-screen.tsx';

/*
 * The Roadmap against a mock backend: the fixture roadmap, its projects, and issue PATCHes
 * that are recorded and answered (or refused) as a test asks.
 */

const PROJECT = (key: string, id: string) => ({
  id,
  key,
  name: key === 'PLT' ? 'Platform Core' : 'Mobile App',
  description: null,
  teamId: null,
  method: 'scrum',
  schemeOverrides: {},
  defaultSpaceId: null,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const patches: { key: string; body: unknown }[] = [];
let patchStatus = 200;
let roadmapStatus = 200;
let roadmapQueries: string[] = [];

const server = setupServer(
  http.get('*/api/v1/work/projects', () =>
    HttpResponse.json({
      items: [PROJECT('PLT', IDS.plt), PROJECT('MOB', IDS.mob)],
      nextCursor: null,
    }),
  ),
  http.get('*/api/v1/work/roadmap', ({ request }) => {
    roadmapQueries.push(new URL(request.url).search);
    return roadmapStatus === 200
      ? HttpResponse.json(roadmapView())
      : HttpResponse.json(
          { code: 'internal', message: 'The server stumbled', requestId: 'r1' },
          { status: roadmapStatus },
        );
  }),
  http.patch('*/api/v1/work/issues/:key', async ({ params, request }) => {
    patches.push({ key: String(params['key']), body: await request.json() });
    if (patchStatus !== 200)
      return HttpResponse.json(
        { code: 'forbidden', message: 'No', requestId: 'r2' },
        { status: patchStatus },
      );
    return HttpResponse.json({
      id: IDS.billing,
      projectId: IDS.plt,
      number: 150,
      key: String(params['key']),
      typeId: IDS.billing,
      title: 'Billing v2',
      description: null,
      descriptionText: '',
      statusId: IDS.billing,
      priority: 'medium',
      assigneeId: null,
      reporterId: null,
      parentId: null,
      sprintId: null,
      estimate: null,
      dueAt: null,
      fixVersionId: null,
      componentId: null,
      customFields: {},
      labelIds: [],
      rank: 'n',
      statusChangedAt: '2026-10-01T00:00:00.000Z',
      resolvedAt: null,
      deletedAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    });
  }),
  http.get('*/api/v1/users', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 404 })),
  http.get('*/api/v1/work/issues/:key', () => HttpResponse.json({}, { status: 404 })),
);

beforeAll(() => server.listen({ onUnhandledFrame: 'bypass' }));
beforeEach(() => {
  // Wide enough that the forecast panel docks beside the roadmap.
  (window as { happyDOM?: { setViewport(size: { width: number }): void } }).happyDOM?.setViewport({
    width: 1440,
  });
  patches.length = 0;
  patchStatus = 200;
  roadmapStatus = 200;
  roadmapQueries = [];
  window.history.replaceState(null, '', '/work/roadmap/PLT');
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function renderRoadmap(projectKey: string | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RoadmapScreen projectKey={projectKey} rest={[]} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const bar = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}, `) });

describe('Roadmap screen', () => {
  it('draws one project’s epics and versions with their forecasts, done items hidden', async () => {
    renderRoadmap('PLT');
    expect(screen.getByRole('status', { name: 'Loading the roadmap' })).toBeTruthy();
    await screen.findByRole('list', { name: 'Roadmap' });
    expect(roadmapQueries).toEqual(['?projects=PLT']);
    expect(bar('Billing v2').getAttribute('aria-label')).toBe(
      'Billing v2, Sep 22 – Oct 21, 33% done, 11 days late',
    );
    expect(screen.getByRole('button', { name: 'Billing v2 forecast: 11 days late' })).toBeTruthy();
    expect(screen.queryByText('Self-serve onboarding')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      'Billing v2 is likely 11 days past its Oct 21 target. 1 item waits on it.',
    );
    // A version the person may not move has no grips and no keys.
    expect(bar('1.4').getAttribute('aria-keyshortcuts')).toBeNull();
  });

  it('opens a forecast in words beside the roadmap, and closes it from the address', async () => {
    renderRoadmap('PLT');
    fireEvent.click(await screen.findByRole('button', { name: 'View forecast' }));
    const panel = await screen.findByRole('complementary', { name: 'Billing v2 forecast' });
    expect(within(panel).getByRole('heading', { name: 'Likely Nov 1' })).toBeTruthy();
    expect(panel.textContent).toContain('Over the last 8 weeks, Platform Core finished');
    expect(within(panel).getByText('Observability')).toBeTruthy();
    expect(window.location.search).toContain(`forecast=${IDS.billing}`);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(window.location.search).not.toContain('forecast='));
  });

  it('moves a bar a week with Shift and the arrow, sending the target where the epic keeps it', async () => {
    renderRoadmap('PLT');
    await screen.findByRole('list', { name: 'Roadmap' });
    fireEvent.keyDown(bar('Billing v2'), { key: 'ArrowRight', shiftKey: true });
    // The bar moves in the same frame; the change is sent once the keys rest.
    expect(bar('Billing v2').getAttribute('aria-label')).toContain('Sep 29 – Oct 28');
    expect(patches).toHaveLength(0);
    await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2000 });
    expect(patches[0]).toEqual({
      key: 'PLT-150',
      body: { startAt: '2026-09-29', customFields: { target_date: '2026-10-28' } },
    });
    expect(await screen.findByText('Billing v2 moved to Sep 29 – Oct 28')).toBeTruthy();
  });

  it('puts a refused move back and offers to try again', async () => {
    patchStatus = 403;
    renderRoadmap('PLT');
    await screen.findByRole('list', { name: 'Roadmap' });
    fireEvent.keyDown(bar('Auth service'), { key: 'ArrowLeft' });
    expect(await screen.findByText('Couldn’t move Auth service'.replace('’', "'"))).toBeTruthy();
    expect(bar('Auth service').getAttribute('aria-label')).toContain('Sep 8 – Oct 30');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('opens an epic to its issues and steps between rows with the arrow keys', async () => {
    renderRoadmap('PLT');
    await screen.findByRole('list', { name: 'Roadmap' });
    fireEvent.click(screen.getByRole('button', { name: 'Show the issues in Auth service' }));
    expect(screen.getByText('Session store migration')).toBeTruthy();
    const billing = screen.getByRole('button', { name: 'Billing v2' });
    billing.focus();
    fireEvent.keyDown(billing, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Auth service');
  });

  it('groups every project by team when asked, and says when filters hide everything', async () => {
    window.history.replaceState(null, '', '/work/roadmap?group=team');
    renderRoadmap(undefined);
    await screen.findByRole('list', { name: 'Roadmap' });
    expect(roadmapQueries).toEqual(['']);
    expect(screen.getByRole('button', { name: /^Mobile/ })).toBeTruthy();
    act(() => window.history.replaceState(null, '', '/work/roadmap?q=nothing-like-this'));
    act(() => void window.dispatchEvent(new Event('popstate')));
    expect(await screen.findByText('Nothing matches these filters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('list', { name: 'Roadmap' })).toBeTruthy();
  });

  it('says what happened when the roadmap does not load, with Try again', async () => {
    roadmapStatus = 500;
    renderRoadmap('PLT');
    expect(await screen.findByText('The roadmap did not load')).toBeTruthy();
    roadmapStatus = 200;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Roadmap' })).toBeTruthy();
  });

  it('says there is no such project for a key the person cannot see', async () => {
    renderRoadmap('NOPE');
    expect(await screen.findByText('There is no project NOPE you can see.')).toBeTruthy();
  });
});
