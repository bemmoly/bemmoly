import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { listed, newClient, providers, space, startServer, summary } from '../test-support.tsx';
import { SpaceLayout } from './space-layout.tsx';

const ROOTS = [summary('Onboarding'), summary('Architecture'), summary('Runbooks')];
const [ONBOARDING, , RUNBOOKS] = ROOTS;

const { server, calls } = startServer(
  http.get('*/api/v1/docs/spaces/ENG', () => HttpResponse.json(space())),
  http.get('*/api/v1/docs/spaces', () => HttpResponse.json(listed([space()]))),
  http.get('*/api/v1/docs/spaces/ENG/tree', () => HttpResponse.json(listed(ROOTS))),
  http.get('*/api/v1/docs/home/starred', () => HttpResponse.json(listed([]))),
  http.get('*/api/v1/auth/me', () => HttpResponse.json({}, { status: 401 })),
);

function renderSidebar() {
  const client = newClient();
  render(
    <SpaceLayout spaceRef="ENG">
      <p>main column</p>
    </SpaceLayout>,
    { wrapper: providers(client) },
  );
  return client;
}

const rowTitles = () =>
  within(screen.getAllByRole('tree')[0]!)
    .getAllByRole('treeitem')
    .map((row) => row.textContent);

describe('the space sidebar', () => {
  it('shows the space head, its search and the page tree beside the main column', async () => {
    renderSidebar();
    expect(await screen.findAllByRole('tree', { name: 'Pages in Engineering' })).not.toHaveLength(
      0,
    );
    expect(screen.getAllByRole('button', { name: 'Engineering, switch space' })).not.toHaveLength(
      0,
    );
    expect(screen.getAllByRole('searchbox', { name: 'Search Engineering' })).not.toHaveLength(0);
    expect(screen.getByText('main column')).toBeTruthy();
    expect(rowTitles()).toEqual(['Onboarding', 'Architecture', 'Runbooks']);
  });

  it('moves a page at once and keeps it when the server agrees', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/move', async () => {
        await delay(30);
        return HttpResponse.json({ page: { ...RUNBOOKS, position: 'a' }, movedCount: 1 });
      }),
    );
    renderSidebar();
    await screen.findAllByRole('tree');
    const row = within(screen.getAllByRole('tree')[0]!).getByRole('treeitem', {
      name: 'Runbooks',
    });
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
    await screen.findAllByRole('tree');
    const row = within(screen.getAllByRole('tree')[0]!).getByRole('treeitem', {
      name: 'Runbooks',
    });
    fireEvent.keyDown(row, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(rowTitles()[1]).toBe('Runbooks'));
    expect(await screen.findByText('The page was not moved')).toBeTruthy();
    expect(rowTitles()).toEqual(['Onboarding', 'Architecture', 'Runbooks']);
  });

  it('asks for the first page when the space is empty', async () => {
    server.use(http.get('*/api/v1/docs/spaces/ENG/tree', () => HttpResponse.json(listed([]))));
    renderSidebar();
    expect((await screen.findAllByText('No pages yet')).length).toBeGreaterThan(0);
  });
});
