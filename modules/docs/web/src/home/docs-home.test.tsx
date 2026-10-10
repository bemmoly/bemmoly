import { queryKeys } from '@bemmoly/api-client';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { listed, newClient, providers, space, startServer, summary } from '../test-support.tsx';
import { docsKeys } from '../shared/keys.ts';
import DocsHomeScreen from './docs-home-screen.tsx';

const OWNER = '0199c0de-0000-7000-8000-000000000777';
const RFC = summary('Auth service RFC', { ownerId: OWNER, status: 'in_review' });
const OLD = summary('On-call escalation policy', { ownerId: OWNER, status: 'published' });

const me = {
  user: { id: OWNER, name: 'Priya N.' },
  workspace: { name: 'Acme Labs' },
  capabilities: ['docs.space.create'],
};

const { server } = startServer(
  http.get('*/api/v1/docs/spaces', () =>
    HttpResponse.json(
      listed([
        space({ pageCount: 184 }),
        space({ id: OWNER, key: 'PRD', name: 'Product', pageCount: 62 }),
      ]),
    ),
  ),
  http.get('*/api/v1/docs/spaces/:key/tree', () =>
    HttpResponse.json(listed([summary('Architecture'), summary('Runbooks')])),
  ),
  http.get('*/api/v1/docs/home/recent', () => HttpResponse.json(listed([RFC]))),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/home/attention', () =>
    HttpResponse.json({ items: [], staleAfterDays: 90 }),
  ),
  http.get('*/api/v1/docs/templates', () => HttpResponse.json({ items: [] })),
);

/** The shell has the session cached before a module chunk renders. */
function client() {
  const cache = newClient();
  cache.setQueryData(queryKeys.me(), me);
  cache.setQueryData(docsKeys.people(), listed([{ id: OWNER, name: 'Priya N.' }]));
  return cache;
}

function renderHome(screenName = 'home') {
  render(<DocsHomeScreen segment={undefined} rest={[]} screen={screenName} />, {
    wrapper: providers(client()),
  });
}

describe('the Docs home', () => {
  it('shows the totals, the space cards and the recent pages with their owners', async () => {
    renderHome();
    expect((await screen.findAllByText('Engineering')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product').length).toBeGreaterThan(0);
    expect(await screen.findByText('2 spaces · 246 pages · Acme Labs')).toBeTruthy();
    expect(await screen.findByRole('link', { name: /Auth service RFC/ })).toBeTruthy();
    expect((await screen.findAllByText('Priya N.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Architecture').length).toBe(2);
  });

  it('leaves out needs attention when nothing waits', async () => {
    renderHome();
    await screen.findAllByText('Engineering');
    expect(screen.queryByText('Needs attention')).toBeNull();
  });

  it('lists reviews asked of the person and their stale pages', async () => {
    server.use(
      http.get('*/api/v1/docs/home/attention', () =>
        HttpResponse.json({
          items: [
            { kind: 'review', page: RFC, since: RFC.updatedAt },
            { kind: 'stale', page: OLD, since: OLD.updatedAt },
          ],
          staleAfterDays: 90,
        }),
      ),
    );
    renderHome();
    expect(await screen.findByRole('list', { name: 'Needs attention' })).toBeTruthy();
    expect(screen.getByText('Review requested')).toBeTruthy();
    expect(screen.getByText('Stale:')).toBeTruthy();
  });

  it('guides a first run when there are no spaces', async () => {
    server.use(http.get('*/api/v1/docs/spaces', () => HttpResponse.json(listed([]))));
    renderHome();
    expect(await screen.findByText('Write it down once, find it later')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Create space' }).length).toBeGreaterThan(0);
  });

  it('opens the create-space dialog for the Create menu entry', async () => {
    render(<DocsHomeScreen segment="new" rest={[]} screen="spaces" />, {
      wrapper: providers(client()),
    });
    expect(await screen.findByRole('dialog', { name: 'Create space' })).toBeTruthy();
  });
});
