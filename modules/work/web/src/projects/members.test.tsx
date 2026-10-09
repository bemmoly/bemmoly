import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, IDS, Providers, startServer, user } from '../issue/test-support.tsx';
import MembersScreen from './members-screen.tsx';

const server = startServer();

const ROLES = {
  admin: id(90),
  projectAdmin: id(91),
  member: id(92),
  viewer: id(93),
};
const roles = [
  { id: ROLES.admin, key: 'org_admin', name: 'Org admin' },
  { id: ROLES.projectAdmin, key: 'project_admin', name: 'Project admin' },
  { id: ROLES.member, key: 'member', name: 'Member' },
  { id: ROLES.viewer, key: 'viewer', name: 'Viewer' },
];
const JONAS = id(94);

const member = (userId: string, name: string, roleKey: keyof typeof ROLES) => ({
  userId,
  name,
  email: `${name.split(' ')[0]?.toLowerCase()}@acme.test`,
  status: 'active',
  roleId: ROLES[roleKey],
  roleKey: roleKey === 'projectAdmin' ? 'project_admin' : roleKey,
  roleName: roles.find((role) => role.id === ROLES[roleKey])?.name,
  addedAt: '2026-10-01T10:00:00.000Z',
});

function serve(canManage = true) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const items = [
    member(IDS.rohan, 'Rohan S.', 'projectAdmin'),
    member(IDS.aisha, 'Aisha K.', 'member'),
  ];
  const record = async (request: Request) => {
    const text = request.method === 'DELETE' ? '' : await request.text();
    calls.push({ method: request.method, url: request.url, body: text ? JSON.parse(text) : null });
  };
  server.use(
    http.get('*/api/v1/work/projects/PLT/members', () =>
      HttpResponse.json({ items, roles, canManage }),
    ),
    http.post('*/api/v1/work/projects/PLT/members', async ({ request }) => {
      await record(request);
      return HttpResponse.json({ items: [member(JONAS, 'Jonas M.', 'member')] }, { status: 201 });
    }),
    http.patch('*/api/v1/work/projects/PLT/members/:userId', async ({ request }) => {
      await record(request);
      return HttpResponse.json(member(IDS.aisha, 'Aisha K.', 'viewer'));
    }),
    http.delete('*/api/v1/work/projects/PLT/members/:userId', async ({ request }) => {
      await record(request);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('*/api/v1/users', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      const everyone = [
        user(IDS.rohan, 'Rohan S.'),
        user(IDS.aisha, 'Aisha K.'),
        user(JONAS, 'Jonas M.'),
      ];
      return HttpResponse.json({
        items: everyone.filter((person) => person.name.toLowerCase().includes(q.toLowerCase())),
        nextCursor: null,
      });
    }),
    http.get('*/api/v1/teams', () => HttpResponse.json({ items: [], nextCursor: null })),
  );
  render(
    <Providers>
      <MembersScreen projectKey="PLT" rest={[]} />
    </Providers>,
  );
  return calls;
}

const rowOf = async (name: string) =>
  (await screen.findByText(name)).closest('[role="row"]') as HTMLElement;

describe('MembersScreen', () => {
  it('lists members with their project role and guards the last project admin', async () => {
    serve();
    const rohan = await rowOf('Rohan S.');
    const role = within(rohan).getByRole('combobox', { name: 'Project role for Rohan S.' });
    expect(role.textContent).toContain('Project admin');
    expect(role.hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(rohan).getByRole('button', { name: 'Actions for Rohan S.' }));
    const remove = await screen.findByRole('menuitem', { name: /Remove from project/ });
    expect(remove.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('2 people')).toBeTruthy();
  });

  it('changes a member role', async () => {
    const calls = serve();
    const aisha = await rowOf('Aisha K.');
    fireEvent.click(within(aisha).getByRole('combobox', { name: 'Project role for Aisha K.' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Viewer' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: { roleId: ROLES.viewer } });
    expect(calls[0]?.url).toContain(`/members/${IDS.aisha}`);
  });

  it('reads back a removal before sending it', async () => {
    const calls = serve();
    const aisha = await rowOf('Aisha K.');
    fireEvent.click(within(aisha).getByRole('button', { name: 'Actions for Aisha K.' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Remove from project/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/lose access to PLT's issues, board and backlog/)).toBeTruthy();
    expect(calls).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove from project' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'DELETE' });
    expect(calls[0]?.url).toContain(`/members/${IDS.aisha}`);
  });

  it('adds a person found by server search, leaving out current members', async () => {
    const calls = serve();
    await rowOf('Rohan S.');
    fireEvent.click(screen.getByRole('button', { name: 'Add people' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('combobox', { name: /People/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Search people' }), {
      target: { value: 'o' },
    });
    await screen.findByRole('option', { name: /Jonas M\./ });
    expect(screen.queryByRole('option', { name: /Rohan S\./ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /Jonas M\./ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to project' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'POST', body: { userIds: [JONAS], teamIds: [] } });
  });

  it('shows members read-only to someone who cannot configure the project', async () => {
    serve(false);
    await rowOf('Aisha K.');
    expect(screen.getByRole('button', { name: 'Add people' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Actions for Aisha K.' })).toBeNull();
  });
});
