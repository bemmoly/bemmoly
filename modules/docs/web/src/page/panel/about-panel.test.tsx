import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listed, space, startServer, summary } from '../../test-support.tsx';
import {
  collabState,
  MEMBERS,
  PAGE_ID,
  pageDetail,
  renderPage,
  ROHAN,
} from '../page-test-support.tsx';
import { ABOUT_PANEL, usePageChrome } from '../screen-context.ts';

const live = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('../../collab/use-collab-page.ts', () => ({ useCollabPage: () => live.state }));

let page = pageDetail();

const { calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId', () => HttpResponse.json(page)),
  http.get('*/api/v1/docs/spaces/ENG', () => HttpResponse.json(space())),
  http.get('*/api/v1/docs/spaces/ENG/tree', () =>
    HttpResponse.json(listed([summary('Architecture')])),
  ),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/spaces/:key/members', () => HttpResponse.json(MEMBERS)),
  http.get('*/api/v1/docs/labels', () =>
    HttpResponse.json({ items: [{ name: 'auth', pageCount: 4 }], nextCursor: null }),
  ),
  http.get('*/api/v1/docs/pages/:pageId/revisions', () =>
    HttpResponse.json(
      listed([
        {
          id: PAGE_ID,
          pageId: PAGE_ID,
          number: 1,
          kind: 'periodic',
          label: null,
          title: 'Auth service RFC',
          wordCount: 200,
          authorIds: [ROHAN],
          createdBy: ROHAN,
          createdAt: '2026-09-12T10:00:00.000Z',
        },
      ]),
    ),
  ),
  http.put('*/api/v1/docs/pages/:pageId/labels', async ({ request }) =>
    HttpResponse.json(await request.json()),
  ),
  http.put('*/api/v1/docs/pages/:pageId/reviewers', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
  http.delete('*/api/v1/docs/pages/:pageId', () => new HttpResponse(null, { status: 204 })),
  http.post('*/api/v1/docs/pages/:pageId/restore', () => HttpResponse.json(pageDetail())),
);

beforeEach(() => {
  page = pageDetail();
  live.state = collabState();
  usePageChrome.setState({ panel: null });
});

const panel = () => screen.findByRole('complementary', { name: 'Page details' });

describe('the About panel', () => {
  it('opens from the header and lists the page’s facts', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'About' }));
    const about = await panel();
    expect(within(about).getByRole('tab', { name: 'About' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(within(about).getByText('About this page')).toBeTruthy();
    expect(within(about).getByText('240 words')).toBeTruthy();
    expect(within(about).getByText(/Sep 12 by Priya N\./)).toBeTruthy();
    expect(within(about).getByText(/by Jonas M\./)).toBeTruthy();
    await waitFor(() =>
      expect(
        within(about).getByLabelText('3 contributors').querySelectorAll(':scope > [title]'),
      ).toHaveLength(3),
    );
    fireEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.queryByRole('complementary', { name: 'Page details' })).toBeNull();
  });

  it('adds and removes labels in place', async () => {
    usePageChrome.setState({ panel: ABOUT_PANEL });
    renderPage();
    const about = await panel();
    fireEvent.click(within(about).getByRole('button', { name: '+ Add label' }));
    const field = within(about).getByRole('combobox', { name: 'New label' });
    fireEvent.change(field, { target: { value: 'auth' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ labels: ['rfc', 'auth'] }));
    fireEvent.click(within(about).getByRole('button', { name: 'Remove label rfc' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ labels: ['auth'] }));
  });

  it('changes the reviewers', async () => {
    usePageChrome.setState({ panel: ABOUT_PANEL });
    renderPage();
    const about = await panel();
    fireEvent.click(within(about).getByRole('button', { name: '+ Add reviewers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reviewers' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Rohan S.' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save reviewers' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ reviewers: [ROHAN] }));
    expect(await within(about).findByText('Rohan S.')).toBeTruthy();
  });
});

describe('the More menu', () => {
  it('moves the page to the trash with an Undo that restores it', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Duplicate/ })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to trash' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(calls.map(({ method, path }) => `${method} ${path.split('/').pop()}`)).toEqual([
        `DELETE ${PAGE_ID}`,
        'POST restore',
      ]),
    );
  });
});
