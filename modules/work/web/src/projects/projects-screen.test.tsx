import type { Project } from '@bemmoly/module-work/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, project, Providers, startServer } from '../issue/test-support.tsx';
import ProjectsScreen from './projects-screen.tsx';
import { meHandler } from './test-me.ts';
import { readView, viewRows, writeView } from './projects-view.ts';

const server = startServer();

const mobile: Project = {
  ...project,
  id: id(70),
  key: 'MOB',
  name: 'Mobile App',
  description: 'iOS and Android clients',
  method: 'kanban',
  updatedAt: '2026-10-09T10:00:00.000Z',
};
const old = {
  ...project,
  id: id(71),
  key: 'OLD',
  name: 'Legacy',
  archivedAt: '2026-09-01T10:00:00.000Z',
} as Project;

describe('the projects view', () => {
  it('round-trips through the address and leaves defaults out', () => {
    expect(writeView(readView(''))).toBe('');
    const view = readView('?q=mob&show=starred&view=grid&sort=updated.desc');
    expect(view).toEqual({
      q: 'mob',
      segment: 'starred',
      layout: 'grid',
      sort: { key: 'updated', direction: 'desc' },
    });
    expect(readView(writeView(view))).toEqual(view);
  });

  it('splits archived projects off, searches keys and sorts', () => {
    const all = [project as Project, mobile, old];
    const base = readView('');
    expect(viewRows(all, base, () => false).map((row) => row.key)).toEqual(['MOB', 'PLT']);
    expect(viewRows(all, { ...base, segment: 'archived' }, () => false)).toEqual([old]);
    expect(viewRows(all, { ...base, q: 'plt' }, () => false).map((row) => row.key)).toEqual([
      'PLT',
    ]);
    expect(
      viewRows(all, { ...base, segment: 'starred' }, (key) => key === 'MOB').map((r) => r.key),
    ).toEqual(['MOB']);
    const desc = { ...base, sort: { key: 'key', direction: 'desc' as const } };
    expect(viewRows(all, desc, () => false).map((row) => row.key)).toEqual(['PLT', 'MOB']);
  });
});

describe('ProjectsScreen', () => {
  const serve = () => {
    const calls: string[] = [];
    const rows = [{ ...project }, { ...mobile }, { ...old }] as Project[];
    server.use(
      meHandler(['work.project.configure']),
      http.get('*/api/v1/work/projects', () =>
        HttpResponse.json({ items: rows, nextCursor: null }),
      ),
      http.post('*/api/v1/work/projects/:key/:verb', ({ params }) => {
        calls.push(`${String(params['verb'])} ${String(params['key'])}`);
        const row = rows.find((item) => item.key === params['key']) as Project;
        row.archivedAt = params['verb'] === 'archive' ? '2026-10-10T10:00:00.000Z' : null;
        return HttpResponse.json(row);
      }),
    );
    return calls;
  };
  const open = () =>
    render(
      <Providers>
        <ProjectsScreen projectKey={undefined} rest={[]} />
      </Providers>,
    );

  it('archives from the row menu at once and puts it back on Undo', async () => {
    const calls = serve();
    open();
    expect(await screen.findByText('Mobile App')).toBeTruthy();
    expect(screen.queryByText('Legacy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Mobile App' }));
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Board', 'Settings', 'Members', 'Star', expect.stringMatching(/^Archive/)]);
    const archive = within(menu).getByRole('menuitem', { name: /Archive/ });
    await waitFor(() => expect(archive.getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(archive);
    await waitFor(() => expect(screen.queryByText('Mobile App')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls).toEqual(['archive MOB', 'unarchive MOB']));
    expect(await screen.findByText('Mobile App')).toBeTruthy();
  });

  it('stars a project into the Starred segment and explains an empty search', async () => {
    serve();
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Star Mobile App' }));
    fireEvent.click(screen.getByRole('radio', { name: /Starred/ }));
    expect(screen.getByText('Mobile App')).toBeTruthy();
    expect(screen.queryByText('Platform Core')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /All/ }));
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'zzz' } });
    expect(screen.getByText('No projects match “zzz”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Platform Core')).toBeTruthy();
  });

  it('says what failed and retries', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/work/projects', () =>
        fail
          ? HttpResponse.json(
              { code: 'internal', message: 'The server is restarting.', requestId: 't' },
              { status: 500 },
            )
          : HttpResponse.json({ items: [project], nextCursor: null }),
      ),
    );
    open();
    expect(await screen.findByText('Projects could not be loaded')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Platform Core')).toBeTruthy();
  });
});
