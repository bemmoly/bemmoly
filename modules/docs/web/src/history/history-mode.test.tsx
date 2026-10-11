import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { diffDocs } from '../../../shared/diff/index.ts';
import { doc, p } from '../../../shared/diff/fixtures.ts';
import { id, listed, newClient, providers, startServer } from '../test-support.tsx';
import { HistoryMode } from './history-mode.tsx';

const PAGE = id(700);
const AUTHOR = id(701);

function revision(number: number, overrides: Record<string, unknown> = {}) {
  return {
    id: id(710 + number),
    pageId: PAGE,
    number,
    kind: 'periodic',
    label: null,
    title: 'Auth service RFC',
    wordCount: 100 + number,
    authorIds: [AUTHOR],
    createdBy: AUTHOR,
    createdAt: `2026-10-0${number}T10:00:00.000Z`,
    ...overrides,
  };
}

const V3 = revision(3, { kind: 'named', label: 'Before review' });
const V2 = revision(2, { kind: 'publish' });
const V1 = revision(1);
const REVISIONS = [V3, V2, V1];

const COMPARE = {
  pageId: PAGE,
  from: { revision: V3, title: 'Auth service RFC' },
  to: { revision: null, title: 'Auth service RFC' },
  diff: diffDocs(doc(p('Valid for 15 minutes.')), doc(p('Valid for 30 minutes.'))),
};

const { server, calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/revisions', () => HttpResponse.json(listed(REVISIONS))),
  http.get('*/api/v1/docs/pages/:pageId/revisions/compare', () => HttpResponse.json(COMPARE)),
  http.get('*/api/v1/users', () =>
    HttpResponse.json(
      listed([
        {
          id: AUTHOR,
          name: 'Priya Nair',
          email: 'priya@acme.test',
          status: 'active',
          roleId: null,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ]),
    ),
  ),
);

function renderMode(canEdit = true) {
  const onExit = vi.fn();
  render(<HistoryMode pageId={PAGE} canEdit={canEdit} onExit={onExit} />, {
    wrapper: providers(newClient()),
  });
  return onExit;
}

const versionNames = () =>
  [...document.querySelectorAll('[data-version]')].map(
    (row) => row.querySelector('.truncate')?.textContent,
  );

describe('the history mode', () => {
  it('lists versions by day and compares the one before the latest with now', async () => {
    let asked = '';
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/revisions/compare', ({ request }) => {
        asked = new URL(request.url).search;
        return HttpResponse.json(COMPARE);
      }),
    );
    renderMode();
    expect(await screen.findByRole('button', { name: /Before review/ })).toBeTruthy();
    expect(versionNames()).toEqual(['Before review', 'Published', 'Autosaved']);
    expect(await screen.findByText('1 edited')).toBeTruthy();
    expect(document.querySelector('[data-history-mode] ins')?.textContent).toBe('30');
    expect(asked).toBe(`?from=${V2.id}&to=current`);
  });

  it('names a version', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/revisions', () =>
        HttpResponse.json(revision(4, { kind: 'named', label: 'Ready' }), { status: 201 }),
      ),
    );
    renderMode();
    fireEvent.click(await screen.findByRole('button', { name: 'Name this version' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), {
      target: { value: 'Ready' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: `/api/v1/docs/pages/${PAGE}/revisions`,
        body: { label: 'Ready' },
      }),
    );
  });

  it('restores at once, keeping the page as it was, and Undo puts it back', async () => {
    const before = revision(4, { kind: 'named', label: 'Before restoring Published' });
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/revisions', () =>
        HttpResponse.json(before, { status: 201 }),
      ),
      http.post('*/api/v1/docs/pages/:pageId/revisions/:revisionId/restore', () =>
        HttpResponse.json(revision(5, { kind: 'restore' })),
      ),
    );
    const onExit = renderMode();
    fireEvent.click(await screen.findByRole('button', { name: /Published/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onExit).toHaveBeenCalled();
    fireEvent.click(undo);
    await waitFor(() =>
      expect(
        calls.map((call) => `${call.method} ${call.path.split('/').slice(-2).join('/')}`),
      ).toEqual([`POST ${PAGE}/revisions`, `POST ${V2.id}/restore`, `POST ${before.id}/restore`]),
    );
  });

  it('lets readers compare but not name or restore', async () => {
    renderMode(false);
    expect(await screen.findByRole('button', { name: /Before review/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Name this version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore this version' })).toBeNull();
  });

  it('leaves on Escape', async () => {
    const onExit = renderMode();
    await screen.findByRole('button', { name: /Before review/ });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('explains an empty history', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/revisions', () => HttpResponse.json(listed([]))),
    );
    renderMode();
    expect((await screen.findAllByText('This is the first version')).length).toBeGreaterThan(0);
  });
});
