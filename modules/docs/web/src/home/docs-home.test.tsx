import { queryKeys } from '@bemmoly/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
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

/** The first pages of a space come with it; the home asks no tree. */
const TOPS = [summary('Architecture'), summary('Runbooks')].map(({ id, title, icon }) => ({
  id,
  title,
  icon,
}));

const { server } = startServer(
  http.get('*/api/v1/docs/spaces', () =>
    HttpResponse.json(
      listed([
        space({ pageCount: 184, topPages: TOPS }),
        space({ id: OWNER, key: 'PRD', name: 'Product', pageCount: 62, topPages: TOPS }),
      ]),
    ),
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
  it('shows the totals, jump back in and the recent pages with who edited them', async () => {
    renderHome();
    expect((await screen.findAllByText('Engineering')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product').length).toBeGreaterThan(0);
    expect(await screen.findByText('2 spaces · 246 pages')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Jump back in' })).toBeTruthy();
    expect((await screen.findAllByRole('link', { name: /Auth service RFC/ })).length).toBe(2);
    expect(screen.getByRole('radio', { name: 'Recent' })).toBeTruthy();
  });

  it('leaves out Needs you when nothing waits', async () => {
    renderHome();
    await screen.findAllByText('Engineering');
    expect(screen.queryByText('Needs you')).toBeNull();
  });

  it('lists reviews asked of the person and their stale pages, and counts them', async () => {
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
    const needs = await screen.findByRole('list', { name: 'Needs you' });
    expect(needs.textContent).toContain('Priya N. asked you to review');
    expect(needs.textContent).toContain('Not updated for a while');
    expect(await screen.findByText(/1 page waiting for your review/)).toBeTruthy();
    fireEvent.keyDown(window, { key: '4' });
    expect(screen.getByRole('radio', { name: 'For review · 1' }).getAttribute('aria-checked')).toBe(
      'true',
    );
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
