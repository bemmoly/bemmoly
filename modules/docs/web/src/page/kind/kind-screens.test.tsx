import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listed, space, startServer, summary } from '../../test-support.tsx';
import { collabState, MEMBERS, PAGE_ID, pageDetail, renderPage } from '../page-test-support.tsx';

const live = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('../../collab/use-collab-page.ts', () => ({ useCollabPage: () => live.state }));

const FILE = '/api/v1/files/0199c0de-0000-7000-8000-0000000000c1';
const report = {
  type: 'doc',
  content: [{ type: 'file', attrs: { src: FILE, name: 'q3.html', mime: 'text/html' } }],
};

let page = pageDetail();
let children: unknown[] = [];

const { calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId', () => HttpResponse.json(page)),
  http.get('*/api/v1/docs/spaces/ENG', () => HttpResponse.json(space())),
  http.get('*/api/v1/docs/spaces/ENG/tree', ({ request }) =>
    HttpResponse.json(
      listed(new URL(request.url).searchParams.get('parentId') === PAGE_ID ? children : []),
    ),
  ),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/docs/spaces/:key/members', () => HttpResponse.json(MEMBERS)),
  http.patch('*/api/v1/docs/pages/:pageId', async ({ request }) => {
    page = { ...page, ...((await request.json()) as object) };
    return HttpResponse.json(page);
  }),
);

beforeEach(() => {
  live.state = collabState();
  children = [];
});

describe('a file page', () => {
  it('fills the screen with its file under the bar, with no editor around it', async () => {
    page = pageDetail({ kind: 'file', title: 'Q3 report', snapshot: report });
    renderPage();
    const frame = await screen.findByTitle('q3.html');
    expect(frame.getAttribute('src')).toBe(FILE);
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand q3.html' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Change status/ })).toBeTruthy();
  });

  it('turns back into a page from ···', async () => {
    page = pageDetail({ kind: 'file', title: 'Q3 report', snapshot: report });
    renderPage();
    await screen.findByTitle('q3.html');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Turn into a page' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PATCH',
        path: `/api/v1/docs/pages/${PAGE_ID}`,
        body: { kind: 'page' },
      }),
    );
    expect(await screen.findByRole('textbox', { name: 'Page title' })).toBeTruthy();
  });
});

describe('a folder', () => {
  it('lists what is in it, in order, with no status or editor', async () => {
    page = pageDetail({ kind: 'folder', title: 'Runbooks', snapshot: null });
    children = [
      summary('Deploy', { parentId: PAGE_ID, depth: 2 }),
      summary('Archive', { parentId: PAGE_ID, depth: 2, kind: 'folder' }),
    ];
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Runbooks', level: 1 })).toBeTruthy();
    const rows = await screen.findAllByRole('link', { name: /Deploy|Archive/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Deploy'),
      expect.stringContaining('Archive'),
    ]);
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Change status/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull();
  });

  it('offers New page and New folder while it is empty', async () => {
    page = pageDetail({ kind: 'folder', title: 'Runbooks', snapshot: null });
    renderPage();
    expect(await screen.findByText('This folder is empty')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New folder' })).toBeTruthy();
  });
});
