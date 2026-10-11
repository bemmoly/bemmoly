import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { id, newClient, providers, startServer } from '../test-support.tsx';
import { DocsSettingsScreen } from './docs-settings-screen.tsx';

const at = '2026-10-01T10:00:00.000Z';
const ADA = { id: id(8001), name: 'Ada L.' };

function template(name: string, overrides: Record<string, unknown> = {}) {
  return {
    archivedAt: null as string | null,
    id: id(),
    spaceId: null,
    key: null,
    name,
    description: `${name} description`,
    icon: 'file-text',
    category: 'engineering',
    fields: [],
    isBuiltin: false,
    position: 0,
    createdAt: at,
    updatedAt: at,
    usedBy: 0,
    createdBy: ADA,
    ...overrides,
  };
}

const RFC = template('RFC', {
  key: 'rfc',
  isBuiltin: true,
  createdBy: null,
  usedBy: 12,
  fields: [{ key: 'status', label: 'Status', kind: 'select', options: ['Draft', 'Final'] }],
});
const ADR = template('ADR', { position: 1, usedBy: 1 });
const OLD = template('Old retro', { position: 2, archivedAt: at, category: 'team' });
const BODY = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Summary goes here' }] }],
};

type Row = ReturnType<typeof template>;
let rows: Row[] = [RFC, ADR, OLD];

/** The server's side of archive and restore, so the list read after it agrees. */
function setArchived(templateId: unknown, archivedAt: string | null) {
  rows = rows.map((row) => (row.id === templateId ? { ...row, archivedAt } : row));
  return HttpResponse.json(rows.find((row) => row.id === templateId));
}
const { server, calls } = startServer(
  http.get('*/api/v1/docs/org-templates', () => HttpResponse.json({ items: rows })),
  http.get('*/api/v1/docs/templates/:id', ({ params }) => {
    const row = rows.find((item) => item.id === params['id']);
    return row
      ? HttpResponse.json({ ...row, snapshot: BODY })
      : HttpResponse.json({ code: 'not_found', message: 'Gone', requestId: 't' }, { status: 404 });
  }),
  http.post('*/api/v1/docs/templates/:id/archive', ({ params }) => setArchived(params['id'], at)),
  http.post('*/api/v1/docs/templates/:id/restore', ({ params }) => setArchived(params['id'], null)),
  http.post('*/api/v1/docs/templates/:id/duplicate', () =>
    HttpResponse.json(
      { ...ADR, id: id(8100), name: 'RFC (copy)', snapshot: BODY },
      { status: 201 },
    ),
  ),
  http.put('*/api/v1/docs/org-templates/order', () => new HttpResponse(null, { status: 204 })),
  http.post('*/api/v1/docs/templates', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      { ...template(String(body['name'])), ...body, id: id(8200) },
      { status: 201 },
    );
  }),
);

beforeEach(() => {
  rows = [RFC, ADR, OLD];
  window.history.replaceState(null, '', '/settings/docs');
});

const renderScreen = () => render(<DocsSettingsScreen />, { wrapper: providers(newClient()) });
const table = () => screen.getByRole('table', { name: 'Org templates' });
const rowOf = (name: string) =>
  within(table())
    .getAllByRole('row')
    .find((row) => within(row).queryByText(name, { exact: true }))!;

describe('Settings › Docs', () => {
  it('lists the active org templates in order with their badge, use and maker', async () => {
    renderScreen();
    expect(await screen.findByText('ADR')).toBeTruthy();
    expect(screen.getByText(/Spaces can add their own templates/)).toBeTruthy();
    const names = within(table())
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByText(/^(RFC|ADR)$/)[0]?.textContent);
    expect(names).toEqual(['RFC', 'ADR']);
    expect(within(rowOf('RFC')).getByText('Built-in')).toBeTruthy();
    expect(within(rowOf('RFC')).getByText('12 pages')).toBeTruthy();
    expect(within(rowOf('ADR')).getByText('Ada L.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Archived · 1' })).toBeTruthy();
    expect(screen.queryByText('Old retro')).toBeNull();
  });

  it('searches by the address and offers to clear a search with no match', async () => {
    renderScreen();
    await screen.findByText('ADR');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), {
      target: { value: 'zzz' },
    });
    expect(window.location.search).toBe('?q=zzz');
    expect(await screen.findByText('No templates match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByText('ADR')).toBeTruthy();
    expect(window.location.search).toBe('');
  });

  it('archives at once with Undo, which restores it', async () => {
    renderScreen();
    await screen.findByText('ADR');
    fireEvent.click(within(rowOf('ADR')).getByRole('button', { name: 'Actions for ADR' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    await waitFor(() => expect(screen.queryByText('ADR')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toEqual([
        `/api/v1/docs/templates/${ADR.id}/archive`,
        `/api/v1/docs/templates/${ADR.id}/restore`,
      ]),
    );
  });

  it('restores from Archived', async () => {
    window.history.replaceState(null, '', '/settings/docs?view=archived');
    renderScreen();
    expect(await screen.findByText('Old retro')).toBeTruthy();
    fireEvent.click(within(rowOf('Old retro')).getByRole('button', { name: /Actions for/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Restore' }));
    await waitFor(() => expect(calls[0]?.path).toBe(`/api/v1/docs/templates/${OLD.id}/restore`));
  });

  it('moves a template down from its grip and saves the whole order', async () => {
    renderScreen();
    await screen.findByText('ADR');
    fireEvent.keyDown(screen.getByRole('button', { name: /^Move RFC/ }), { key: 'ArrowDown' });
    await waitFor(() =>
      expect(calls[0]).toEqual({
        method: 'PUT',
        path: '/api/v1/docs/org-templates/order',
        body: { ids: [ADR.id, RFC.id] },
      }),
    );
  });

  it('opens a built-in read only, previews it, and duplicates it to edit', async () => {
    renderScreen();
    fireEvent.click(await screen.findByText('RFC'));
    expect(window.location.search).toBe(`?template=${RFC.id}`);
    expect(await screen.findByText('Summary goes here')).toBeTruthy();
    expect(screen.getByText('Choice: Draft, Final')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Template' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate to edit' }));
    await waitFor(() => expect(window.location.search).toBe(`?template=${id(8100)}&edit=1`));
  });

  it('adds an org template from the editor', async () => {
    renderScreen();
    await screen.findByText('ADR');
    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    const name = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Give the template a name.')).toBeTruthy();
    fireEvent.change(name, { target: { value: 'Launch checklist' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Field label' }), {
      target: { value: 'Launch date' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => expect(calls[0]?.method).toBe('POST'));
    expect(calls[0]?.body).toMatchObject({
      spaceId: null,
      name: 'Launch checklist',
      fields: [{ key: 'launch_date', label: 'Launch date', kind: 'text' }],
    });
    await waitFor(() => expect(window.location.search).toBe(`?template=${id(8200)}`));
  });

  it('tells someone who may not manage templates, with nothing to press', async () => {
    server.use(
      http.get('*/api/v1/docs/org-templates', () =>
        HttpResponse.json(
          { code: 'forbidden', message: 'You do not have permission to do this', requestId: 't' },
          { status: 403 },
        ),
      ),
    );
    renderScreen();
    expect(
      await screen.findByText('Only people who manage org templates can change these'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New template' })).toBeNull();
  });
});
