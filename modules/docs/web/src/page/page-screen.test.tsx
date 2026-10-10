import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listed, space, startServer, summary } from '../test-support.tsx';
import {
  collabState,
  JONAS,
  MEMBERS,
  PAGE_ID,
  pageDetail,
  priyaPeer,
  renderPage,
} from './page-test-support.tsx';
import { usePageChrome } from './screen-context.ts';

const live = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('../collab/use-collab-page.ts', () => ({ useCollabPage: () => live.state }));

let page = pageDetail();

const { server, calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId', () => HttpResponse.json(page)),
  http.get('*/api/v1/docs/spaces/ENG', () => HttpResponse.json(space())),
  http.get('*/api/v1/docs/spaces/ENG/tree', () =>
    HttpResponse.json(listed([summary('Architecture')])),
  ),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/spaces/:key/members', () => HttpResponse.json(MEMBERS)),
  http.get('*/api/v1/docs/pages/:pageId/revisions', () => HttpResponse.json(listed([]))),
  http.patch('*/api/v1/docs/pages/:pageId', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
  http.put('*/api/v1/docs/pages/:pageId/reviewers', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
  http.put('*/api/v1/docs/pages/:pageId/status', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
);

beforeEach(() => {
  page = pageDetail();
  live.state = collabState();
  usePageChrome.setState({ panel: null });
});

const title = () => screen.findByRole('textbox', { name: 'Page title' });

describe('the doc editor screen', () => {
  it('draws the trail, the facts, the title and the body as the mock lays them out', async () => {
    live.state = collabState({ peers: [priyaPeer] });
    renderPage();
    expect(((await title()) as HTMLTextAreaElement).value).toBe('Auth service RFC');
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByRole('link', { name: 'Engineering' }).getAttribute('href')).toBe(
      '/docs/s/ENG',
    );
    expect(within(trail).getByRole('link', { name: 'Architecture' })).toBeTruthy();
    const facts = screen.getByRole('list', { name: 'Page facts' });
    expect(facts.textContent).toBe('rfcOwner: Priya N.');
    expect(screen.getByText(/Created Sep 12 · Edited/)).toBeTruthy();
    expect(screen.getByText('1 min read')).toBeTruthy();
    expect(screen.getByRole('status', { name: '' }).textContent).toBe('Saved · Priya is editing');
    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy();
  });

  it('keeps a stored TL;DR unshown while the workspace has AI off', async () => {
    page = pageDetail({ tldr: 'Sessions move to Postgres in two steps.' });
    renderPage();
    await title();
    expect(screen.queryByText('TL;DR')).toBeNull();
    expect(screen.queryByText('Sessions move to Postgres in two steps.')).toBeNull();
  });

  it('shows the TL;DR in the AI surface once the workspace has AI on', async () => {
    page = pageDetail({ tldr: 'Sessions move to Postgres in two steps.' });
    renderPage({ aiEnabled: true });
    expect(await screen.findByText('Sessions move to Postgres in two steps.')).toBeTruthy();
    expect(screen.getByText('TL;DR')).toBeTruthy();
  });

  it('renames the page from its title and hands the caret on with Enter', async () => {
    renderPage();
    const field = await title();
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Auth service  RFC v2 ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/docs/pages/${PAGE_ID}`,
        body: { title: 'Auth service RFC v2' },
      }),
    );
  });

  it('puts the saved title back on Escape without saving', async () => {
    renderPage();
    const field = (await title()) as HTMLTextAreaElement;
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.blur(field);
    expect(field.value).toBe('Auth service RFC');
    expect(calls.filter((call) => call.method === 'PATCH')).toEqual([]);
  });

  it('asks for review with reviewers picked first, then publishes', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Change status/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Request review…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reviewers' });
    const jonas = await within(dialog).findByRole('checkbox', { name: 'Jonas M.' });
    // The owner does not review their own page; an invited person cannot review yet.
    expect(within(dialog).queryByRole('checkbox', { name: 'Priya N.' })).toBeNull();
    expect(within(dialog).queryByRole('checkbox', { name: 'Sam R.' })).toBeNull();
    fireEvent.click(jonas);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Request review' }));
    await waitFor(() => expect(screen.getAllByText('In review').length).toBeGreaterThan(0));
    expect(calls.map(({ method, path, body }) => [method, path.split('/').pop(), body])).toEqual([
      ['PUT', 'reviewers', { reviewers: [JONAS] }],
      ['PUT', 'status', { status: 'in_review' }],
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Change status/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Publish' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ status: 'published' }));
  });

  it('needs a reviewer before a review, and says in the dialog what the server refused', async () => {
    server.use(
      http.put('*/api/v1/docs/pages/:pageId/reviewers', () =>
        HttpResponse.json(
          {
            code: 'validation_failed',
            message: 'Reviewers must be active members of the space',
            requestId: 't',
          },
          { status: 400 },
        ),
      ),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Change status/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Request review…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reviewers' });
    const confirm = within(dialog).getByRole('button', { name: 'Request review' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Jonas M.' }));
    fireEvent.click(confirm);
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Reviewers must be active members of the space',
    );
  });

  it('greys Publish for someone who may not publish', async () => {
    renderPage({ capabilities: [] });
    fireEvent.click(await screen.findByRole('button', { name: /Change status/ }));
    const publish = await screen.findByRole('menuitem', { name: /Publish/ });
    expect(publish.getAttribute('aria-disabled')).toBe('true');
    expect(publish.textContent).toContain('Needs publish rights');
  });

  it('answers ⌘S that saving is automatic', async () => {
    renderPage();
    await title();
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(await screen.findByText('Saved automatically')).toBeTruthy();
  });

  it('shows an archived page read-only, with the way back to draft', async () => {
    page = pageDetail({ status: 'archived' });
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Auth service RFC' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Move back to draft' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ status: 'draft' }));
  });

  it('reads as read-only for a viewer, with the reason', async () => {
    live.state = collabState({ status: 'read-only', editable: false });
    renderPage();
    expect(await screen.findByText(/You can read this page/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Change status/ })).toBeNull();
  });

  it('says so when offline, and keeps the page editable', async () => {
    live.state = collabState({ status: 'offline' });
    renderPage();
    expect(await screen.findByText(/You are offline/)).toBeTruthy();
    expect(
      screen.getAllByRole('status').some((node) => node.textContent === 'Offline · changes kept'),
    ).toBe(true);
    expect(await title()).toBeTruthy();
  });

  it('opens a page in the trash with its restore banner', async () => {
    page = pageDetail({ deletedAt: '2026-10-01T10:00:00.000Z' });
    server.use(
      http.get('*/api/v1/docs/pages/:pageId', ({ request }) =>
        new URL(request.url).searchParams.get('deleted') === 'true'
          ? HttpResponse.json(page)
          : HttpResponse.json(
              { code: 'not_found', message: 'Gone', requestId: 't' },
              { status: 404 },
            ),
      ),
      http.post('*/api/v1/docs/pages/:pageId/restore', () => HttpResponse.json(pageDetail())),
    );
    renderPage();
    expect(await screen.findByText(/This page is in the trash/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(calls).toContainEqual(
        expect.objectContaining({ method: 'POST', path: `/api/v1/docs/pages/${PAGE_ID}/restore` }),
      ),
    );
  });

  it('tells a missing page from one the person may not open', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId', () =>
        HttpResponse.json({ code: 'forbidden', message: 'No', requestId: 't' }, { status: 403 }),
      ),
    );
    renderPage();
    expect(await screen.findByText('You do not have access to this page')).toBeTruthy();
  });

  it('says a page that is not there, live or trashed, does not exist', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId', () =>
        HttpResponse.json({ code: 'not_found', message: 'No', requestId: 't' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByText('This page does not exist')).toBeTruthy();
  });
});
