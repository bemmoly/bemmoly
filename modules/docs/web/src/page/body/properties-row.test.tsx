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
import { usePageChrome } from '../screen-context.ts';

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
  http.patch('*/api/v1/docs/pages/:pageId', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
  http.get('*/api/v1/docs/pages/:pageId/comments', () => HttpResponse.json(listed([]))),
  http.delete('*/api/v1/docs/pages/:pageId', () => new HttpResponse(null, { status: 204 })),
  http.post('*/api/v1/docs/pages/:pageId/restore', () => HttpResponse.json(pageDetail())),
);

beforeEach(() => {
  page = pageDetail();
  live.state = collabState();
  usePageChrome.setState({ margin: null, chosen: false, mode: 'page' });
});

const row = () => screen.findByRole('group', { name: 'Page properties' });

describe('the properties row', () => {
  it('shows status, owner, labels, the edit time and the reading time in one row', async () => {
    renderPage();
    const props = await row();
    expect(within(props).getByRole('button', { name: /Status: Draft/ })).toBeTruthy();
    expect(within(props).getByRole('button', { name: /Owner: Priya N\./ })).toBeTruthy();
    expect(within(props).getByText('rfc')).toBeTruthy();
    expect(within(props).getByText('Edited')).toBeTruthy();
    expect(within(props).getByText('1 min read')).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Page details' })).toBeNull();
  });

  it('adds labels in place and removes one with Undo', async () => {
    renderPage();
    const props = await row();
    fireEvent.click(within(props).getByRole('button', { name: 'Add label' }));
    const field = within(props).getByRole('combobox', { name: 'New label' });
    fireEvent.change(field, { target: { value: 'auth' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ labels: ['rfc', 'auth'] }));
    fireEvent.click(within(props).getByRole('button', { name: 'Remove label rfc' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ labels: ['auth'] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ labels: ['rfc', 'auth'] }));
  });

  it('changes the reviewers', async () => {
    renderPage();
    const props = await row();
    fireEvent.click(within(props).getByRole('button', { name: 'Add reviewers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reviewers' });
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Rohan S.' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save reviewers' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ reviewers: [ROHAN] }));
    expect(await within(props).findByRole('button', { name: /Reviewers: Rohan S\./ })).toBeTruthy();
  });
});

describe('the page column', () => {
  it('adds a drawn cover, and Undo takes it away again', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add cover' }));
    const picker = await screen.findByRole('dialog', { name: 'Cover' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Orbit' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ cover: 'orbit' }));
    expect(document.querySelector('[data-page-cover="orbit"]')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ cover: null }));
  });

  it('gives the page a drawn icon in a tint', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add icon' }));
    const picker = await screen.findByRole('dialog', { name: 'Page icon' });
    fireEvent.click(within(picker).getByRole('radio', { name: 'Violet' }));
    fireEvent.click(within(picker).getByRole('button', { name: 'flag' }));
    await waitFor(() => expect(calls.at(-1)?.body).toEqual({ icon: 'flag:epic-2' }));
    expect(await screen.findByRole('button', { name: 'Change icon' })).toBeTruthy();
  });
});

describe('the margin', () => {
  it('opens comments from the header toggle and closes it again', async () => {
    renderPage();
    const toggle = await screen.findByRole('button', { name: 'Comments' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const margin = await screen.findByRole('complementary', { name: 'Comments' });
    expect(await within(margin).findByText('No open comments')).toBeTruthy();
    fireEvent.click(within(margin).getByRole('button', { name: 'Close comments' }));
    expect(screen.queryByRole('complementary', { name: 'Comments' })).toBeNull();
  });

  it('toggles comments with ⌘⌥C and enters version history with ⌘⌥H', async () => {
    renderPage();
    await row();
    fireEvent.keyDown(window, { code: 'KeyC', key: 'ç', metaKey: true, altKey: true });
    expect(await screen.findByRole('complementary', { name: 'Comments' })).toBeTruthy();
    fireEvent.keyDown(window, { code: 'KeyC', key: 'ç', metaKey: true, altKey: true });
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Comments' })).toBeNull(),
    );
    fireEvent.keyDown(window, { code: 'KeyH', key: '˙', metaKey: true, altKey: true });
    expect(usePageChrome.getState().mode).toBe('history');
  });
});

describe('Share', () => {
  it('says honestly who can see the page and copies its link', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const share = await screen.findByRole('dialog', { name: 'Share' });
    expect(within(share).getByText('Who can see this')).toBeTruthy();
    const members = await within(share).findByRole('list', { name: 'Space members' });
    expect(within(members).getByText('Rohan S.')).toBeTruthy();
    expect(within(members).queryByText('Sam R.')).toBeNull();
    expect(within(share).getByRole('button', { name: 'Copy link' })).toBeTruthy();
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
