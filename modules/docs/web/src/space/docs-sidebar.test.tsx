import {
  FrameContext,
  readPreference,
  setPreferenceOwner,
  type ModuleSidebarProps,
} from '@bemmoly/core-web';
type ManifestOf = ModuleSidebarProps['manifest'];
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DocsSidebar from '../sidebar.tsx';
import { pageDetail } from '../page/page-test-support.tsx';
import { id, listed, newClient, providers, space, startServer, summary } from '../test-support.tsx';

const ROOTS = [
  summary('Onboarding'),
  summary('Architecture', { hasChildren: true }),
  summary('Runbooks'),
];
const [ONBOARDING, ARCHITECTURE, RUNBOOKS] = ROOTS;
const PRODUCT = space({ id: id(9002), key: 'PROD', name: 'Product', color: 'violet' });

const { server, calls } = startServer(
  http.get('*/api/v1/docs/spaces', () => HttpResponse.json(listed([space(), PRODUCT]))),
  http.get('*/api/v1/docs/spaces/ENG/tree', ({ request }) => {
    const parent = new URL(request.url).searchParams.get('parentId');
    return HttpResponse.json(
      listed(parent ? [summary('Services map', { parentId: parent, depth: 1 })] : ROOTS),
    );
  }),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
);

const navigate = vi.fn();

function renderSidebar(pathname = '/docs/s/ENG') {
  const client = newClient();
  const frame = {
    mode: 'full' as const,
    phone: false,
    pathname,
    navigate,
    openSheet: () => undefined,
    toggleSidebar: () => undefined,
  };
  render(
    <FrameContext.Provider value={frame}>
      <DocsSidebar manifest={{} as ManifestOf} />
    </FrameContext.Provider>,
    { wrapper: providers(client) },
  );
  return client;
}

const tree = () => screen.findByRole('tree', { name: 'Pages in Engineering' });
const rowTitles = () =>
  within(screen.getByRole('tree'))
    .getAllByRole('treeitem')
    .map((row) => row.textContent);

beforeEach(() => setPreferenceOwner('rohan'));
afterEach(() => {
  navigate.mockReset();
  setPreferenceOwner(null);
  window.localStorage.clear();
});

describe('the Docs sidebar', () => {
  it('starts with Docs home, then lists the spaces with the current one open', async () => {
    renderSidebar();
    await tree();
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links[0]).toBe('Docs home');
    expect(links[1]).toMatch(/Engineering$/);
    expect(screen.getByText('Spaces')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Product' })).toBeTruthy();
    expect(rowTitles()).toEqual(['Onboarding', 'Architecture', 'Runbooks']);
    expect(screen.getAllByRole('tree')).toHaveLength(1);
  });

  it('remembers the pages a person opened, under their own name', async () => {
    renderSidebar();
    const architecture = within(await tree()).getByRole('treeitem', { name: 'Architecture' });
    fireEvent.keyDown(architecture, { key: 'ArrowRight' });
    expect(await screen.findByRole('treeitem', { name: 'Services map' })).toBeTruthy();
    expect(readPreference('docs.tree-open', {})).toEqual({ ENG: [ARCHITECTURE!.id] });
    setPreferenceOwner('jonas');
    expect(readPreference('docs.tree-open', {})).toEqual({});
  });

  it('moves a page at once and keeps it when the server agrees', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/move', async () => {
        await delay(30);
        return HttpResponse.json({ page: { ...RUNBOOKS, position: 'a' }, movedCount: 1 });
      }),
    );
    renderSidebar();
    const row = within(await tree()).getByRole('treeitem', { name: 'Runbooks' });
    fireEvent.keyDown(row, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(rowTitles()).toEqual(['Onboarding', 'Runbooks', 'Architecture']));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/api/v1/docs/pages/${RUNBOOKS!.id}/move`,
      body: { parentId: null, afterId: ONBOARDING!.id },
    });
  });

  it('puts the tree back and says so when the server refuses a move', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/move', async () => {
        await delay(30);
        return HttpResponse.json(
          { code: 'conflict', message: 'The page moved elsewhere', requestId: 't' },
          { status: 409 },
        );
      }),
    );
    renderSidebar();
    const row = within(await tree()).getByRole('treeitem', { name: 'Runbooks' });
    fireEvent.keyDown(row, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(rowTitles()[1]).toBe('Runbooks'));
    expect(await screen.findByText('The page was not moved')).toBeTruthy();
    expect(rowTitles()).toEqual(['Onboarding', 'Architecture', 'Runbooks']);
  });

  it('offers one quiet New page row in an empty space, which makes a page and opens it', async () => {
    const made = pageDetail({ id: ONBOARDING!.id, parentId: null, title: '' });
    server.use(
      http.get('*/api/v1/docs/spaces/ENG/tree', () => HttpResponse.json(listed([]))),
      http.post('*/api/v1/docs/pages', () => HttpResponse.json(made, { status: 201 })),
    );
    renderSidebar();
    fireEvent.click(await screen.findByRole('button', { name: /^New page(?! in)/ }));
    await waitFor(() => expect(window.location.pathname).toBe(`/docs/p/${made.id}`));
    expect(calls[0]).toMatchObject({ method: 'POST', body: { parentId: null, title: '' } });
  });

  it("opens a + menu on a page's row: a page, a folder or a file inside it", async () => {
    const made = pageDetail({
      id: id(7301),
      parentId: RUNBOOKS!.id,
      kind: 'folder',
      title: 'New folder',
    });
    server.use(http.post('*/api/v1/docs/pages', () => HttpResponse.json(made, { status: 201 })));
    renderSidebar();
    await tree();
    fireEvent.click(screen.getByRole('button', { name: 'Add inside Runbooks' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Page', 'Folder', 'Upload file']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/docs/p/${made.id}`));
    expect(calls.at(-1)).toMatchObject({
      method: 'POST',
      body: { parentId: RUNBOOKS!.id, kind: 'folder', title: 'New folder' },
    });
  });

  it('offers the same three on the space row', async () => {
    renderSidebar();
    await tree();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Engineering' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Page', 'Folder', 'Upload file']);
  });

  it('gives a space the sidebar in focus mode, with a filter, until Esc', async () => {
    renderSidebar();
    await tree();
    fireEvent.doubleClick(screen.getByRole('link', { name: 'Engineering' }));
    const filter = await screen.findByRole('searchbox', { name: 'Filter Engineering' });
    expect(screen.queryByRole('link', { name: 'Product' })).toBeNull();
    expect(readPreference('docs.tree-focus', null)).toBe('ENG');
    fireEvent.keyDown(filter, { key: 'Escape' });
    expect(await screen.findByRole('link', { name: 'Product' })).toBeTruthy();
    expect(readPreference('docs.tree-focus', null)).toBeNull();
  });

  it('says when the spaces did not load and tries again', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/docs/spaces', () =>
        fail
          ? HttpResponse.json(
              { code: 'internal', message: 'down', requestId: 't' },
              { status: 500 },
            )
          : HttpResponse.json(listed([space()])),
      ),
    );
    renderSidebar();
    expect(await screen.findByText('Spaces did not load.')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await tree()).toBeTruthy();
  });
});
