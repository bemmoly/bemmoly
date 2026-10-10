import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { diffDocs } from '../../../shared/diff/index.ts';
import { doc, p } from '../../../shared/diff/fixtures.ts';
import { id, listed, newClient, providers, startServer } from '../test-support.tsx';
import { HistoryPanel } from './history-panel.tsx';

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

const { server, calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/revisions', () => HttpResponse.json(listed(REVISIONS))),
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

function renderPanel(canEdit = true) {
  render(<HistoryPanel pageId={PAGE} canEdit={canEdit} />, { wrapper: providers(newClient()) });
}

describe('the history panel', () => {
  it('lists versions newest first with their kind and size', async () => {
    renderPanel();
    expect(await screen.findByText('Before review')).toBeTruthy();
    const names = [...document.querySelectorAll('[data-version]')].map(
      (row) => row.querySelector('.font-medium')?.textContent,
    );
    expect(names).toEqual(['Before review', 'Published', 'Autosaved']);
    expect(screen.getByText(/103 words/)).toBeTruthy();
  });

  it('saves a named version', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/revisions', () =>
        HttpResponse.json(revision(4, { kind: 'named', label: 'Ready' }), { status: 201 }),
      ),
    );
    renderPanel();
    await screen.findByText('Before review');
    fireEvent.click(screen.getByRole('button', { name: 'Save version' }));
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

  it('asks before restoring and says what happens', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/revisions/:revisionId/restore', () =>
        HttpResponse.json(revision(4, { kind: 'restore' })),
      ),
    );
    renderPanel();
    await screen.findByText('Before review');
    fireEvent.click(document.querySelector(`[data-version="${V2.id}"]`)!);
    fireEvent.click(screen.getByRole('button', { name: 'Restore…' }));
    expect(await screen.findByText(/Everyone with the page open sees the change/)).toBeTruthy();
    expect(screen.getByText(/saved as a new version/)).toBeTruthy();
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toContain(
        `/api/v1/docs/pages/${PAGE}/revisions/${V2.id}/restore`,
      ),
    );
  });

  it('compares a version with the page now', async () => {
    let asked = '';
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/revisions/compare', ({ request }) => {
        asked = new URL(request.url).search;
        return HttpResponse.json({
          pageId: PAGE,
          from: { revision: V3, title: 'Auth service RFC' },
          to: { revision: null, title: 'Auth service RFC' },
          diff: diffDocs(doc(p('Valid for 15 minutes.')), doc(p('Valid for 30 minutes.'))),
        });
      }),
    );
    renderPanel();
    fireEvent.click(await screen.findByText('Before review'));
    fireEvent.click(screen.getByRole('button', { name: 'Compare with now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compare versions' });
    expect(await within(dialog).findByText('1 edited')).toBeTruthy();
    expect(dialog.querySelector('ins')?.textContent).toBe('30');
    expect(asked).toBe(`?from=${V3.id}&to=current`);
  });

  it('keeps saving and restoring from readers', async () => {
    renderPanel(false);
    fireEvent.click(await screen.findByText('Before review'));
    expect(screen.queryByRole('button', { name: 'Save version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Restore…' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Compare with now' })).toBeTruthy();
  });

  it('explains an empty history', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/revisions', () => HttpResponse.json(listed([]))),
    );
    renderPanel();
    expect(await screen.findByText('No versions yet')).toBeTruthy();
  });
});
