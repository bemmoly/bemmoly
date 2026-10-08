import type { ModuleGrant } from '@bemmoly/shared';
import { act, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { INVITE_TOKEN } from '../mocks/db.ts';
import { ROLE_IDS, TEAM_IDS, USER_IDS } from '../mocks/seed/people.ts';
import { useUiStore } from '../store/ui.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { modulesForUser } from './use-module-access.ts';
import { useUserActions } from './use-users-actions.ts';
import { useInviteForm } from './use-users-invite.ts';
import { directorySummary, isLate, matchesFilters, useUsers } from './use-users.ts';

const submitEvent = { preventDefault: () => undefined } as FormEvent;

const grant = (
  moduleId: string,
  subjectKind: ModuleGrant['subjectKind'],
  subjectId: string | null,
) =>
  ({
    id: `${moduleId}-${subjectKind}`,
    moduleId,
    subjectKind,
    subjectId,
    grantedBy: null,
    createdAt: '',
  }) as ModuleGrant;

describe('users helpers', () => {
  const jonas = { id: USER_IDS.jonas, roleId: ROLE_IDS.member, teamIds: [TEAM_IDS.mobile] };

  it('computes the Modules column from everyone, team, role and person grants', () => {
    const grants = [
      grant('time', 'everyone', null),
      grant('work', 'team', TEAM_IDS.mobile),
      grant('docs', 'role', ROLE_IDS.viewer),
      grant('crm', 'user', USER_IDS.jonas),
      grant('wiki', 'team', TEAM_IDS.design),
    ];
    expect(modulesForUser(jonas, grants)).toEqual(['crm', 'time', 'work']);
    expect(modulesForUser({ ...jonas, teamIds: [] }, grants.slice(1, 3))).toEqual([]);
  });

  it('filters by role and team', () => {
    const user = { ...jonas, email: '', name: '' } as Parameters<typeof matchesFilters>[0];
    expect(matchesFilters(user, { roleId: '', teamId: TEAM_IDS.mobile })).toBe(true);
    expect(matchesFilters(user, { roleId: ROLE_IDS.viewer, teamId: '' })).toBe(false);
  });

  it('marks people unseen for over a week, or never', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    expect(isLate(null, now)).toBe(true);
    expect(isLate('2026-09-20T12:00:00Z', now)).toBe(true);
    expect(isLate('2026-10-06T12:00:00Z', now)).toBe(false);
    expect(directorySummary({ active: 42, invited: 3, deactivated: 2 })).toBe(
      '42 active · 3 invited · 2 deactivated · no seat limit, self-hosted',
    );
  });
});

describe('useUsers', () => {
  it('lists people with their teams and modules, filtered by team', async () => {
    const { result } = await renderQueryHook(() => useUsers(TEAM_IDS.mobile));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.rows.map((user) => user.name)).toEqual(['Jonas M.', 'Dev P.']);
    await waitFor(() =>
      expect(result.current.modulesOf(result.current.rows[0]!)).toEqual(['Sample']),
    );
    await waitFor(() =>
      expect(result.current.teamsOf(result.current.rows[0]!)).toEqual(['Platform', 'Mobile']),
    );
    expect(result.current.summary).toBe(
      '7 active · 1 invited · 0 deactivated · no seat limit, self-hosted',
    );
  });

  it('lists pending invitations as INVITED rows and counts them', async () => {
    const { result } = await renderQueryHook(() => ({
      users: useUsers(),
      invite: useInviteForm(),
    }));
    await waitFor(() => expect(result.current.users.rows).toHaveLength(8));
    const [sam] = result.current.users.rows;
    expect(sam).toMatchObject({ email: 'sam@acmelabs.dev', status: 'invited' });
    expect(result.current.users.isInvitation(sam!)).toBe(true);
    expect(result.current.users.summary).toMatch(/^7 active · 1 invited/);

    act(() => result.current.invite.update({ text: 'new.person@acme.dev' }));
    act(() => result.current.invite.submit(submitEvent));
    await waitFor(() => expect(result.current.invite.sent?.items).toHaveLength(1));
    expect(result.current.invite.sent?.emailConfigured).toBe(false);
    expect(result.current.invite.sent?.items[0]?.acceptUrl).toMatch(/\/accept-invitation#token=/);
    act(() => result.current.users.setStatus('invited'));
    await waitFor(() =>
      expect(result.current.users.rows.map((row) => row.email)).toEqual([
        'sam@acmelabs.dev',
        'new.person@acme.dev',
      ]),
    );
    expect(result.current.users.summary).toMatch(/^7 active · 2 invited/);
  });

  it('searches on the server by name or email', async () => {
    const { result } = await renderQueryHook(() => useUsers());
    await waitFor(() => expect(result.current.rows).toHaveLength(8));
    act(() => result.current.setSearch('contractor.io'));
    await waitFor(() => expect(result.current.rows.map((user) => user.name)).toEqual(['Dev P.']));
  });

  it('takes the search and invite request handed over by ⌘K, once', async () => {
    useUiStore.setState({ userSearch: 'priya', inviteRequested: true });
    const { result } = await renderQueryHook(() => useUsers());
    expect(result.current.filters.q).toBe('priya');
    expect(result.current.inviteOpen).toBe(true);
    expect(useUiStore.getState().userSearch).toBe('');
    expect(useUiStore.getState().inviteRequested).toBe(false);
    await waitFor(() => expect(result.current.rows.map((user) => user.name)).toEqual(['Priya N.']));
    act(() => useUiStore.getState().setUserSearch('lena'));
    expect(result.current.filters.q).toBe('lena');
  });
});

describe('invitations and row actions', () => {
  it('invites several addresses with the least-privileged Viewer role by default', async () => {
    let sent = false;
    const { result } = await renderQueryHook(() => useInviteForm(() => (sent = true)));
    await waitFor(() => expect(result.current.form.roleId).toBe(ROLE_IDS.viewer));
    act(() =>
      result.current.update({ text: 'Ana@acme.dev, ben@acme.dev', teamId: TEAM_IDS.growth }),
    );
    act(() => result.current.submit(submitEvent));
    await waitFor(() => expect(sent).toBe(true));
    const invited = mockApi.db.invitations.filter((item) => item.email.endsWith('@acme.dev'));
    expect(invited.map((item) => [item.email, item.roleId, item.teamId])).toEqual([
      ['ana@acme.dev', ROLE_IDS.viewer, TEAM_IDS.growth],
      ['ben@acme.dev', ROLE_IDS.viewer, TEAM_IDS.growth],
    ]);
  });

  it('refuses anything that is not an address before sending', async () => {
    const { result } = await renderQueryHook(() => useInviteForm(() => undefined));
    act(() => result.current.update({ text: 'ana@acme.dev nope' }));
    act(() => result.current.submit(submitEvent));
    expect(result.current.errors['emails']).toBe('Not an email address: nope');
    act(() => result.current.update({ text: '' }));
    act(() => result.current.submit(submitEvent));
    expect(result.current.errors['emails']).toBe('Add at least one email address');
  });

  it('copies a fresh link, re-invites with a new role, and revokes an invitation', async () => {
    const users = await renderQueryHook(() => useUsers());
    await waitFor(() => expect(users.result.current.rows[0]?.status).toBe('invited'));
    const sam = users.result.current.rows[0]!;
    const { result } = await renderQueryHook(() => useUserActions(mockApi.db.roles));

    act(() => result.current.copyLink.mutate(sam));
    await waitFor(() => expect(result.current.shownLink?.email).toBe('sam@acmelabs.dev'));
    expect(mockApi.db.invitationTokens[INVITE_TOKEN]).toBeUndefined();

    act(() => result.current.resend.mutate({ user: sam, roleId: ROLE_IDS.member }));
    await waitFor(() => expect(result.current.resend.isSuccess).toBe(true));
    const pending = mockApi.db.invitations.filter((item) => !item.revokedAt);
    expect(pending.map((item) => [item.email, item.roleId])).toEqual([
      ['sam@acmelabs.dev', ROLE_IDS.member],
    ]);

    act(() => result.current.revoke.mutate(sam));
    await waitFor(() => expect(result.current.revoke.isSuccess).toBe(true));
    expect(mockApi.db.invitations.every((item) => item.revokedAt)).toBe(true);
  });

  it('deactivates a person', async () => {
    const aisha = mockApi.db.users.find((user) => user.id === USER_IDS.aisha)!;
    const { result } = await renderQueryHook(() => useUserActions([]));
    act(() => result.current.deactivate.mutate(aisha));
    await waitFor(() => expect(result.current.deactivate.isSuccess).toBe(true));
    expect(mockApi.db.users.find((user) => user.id === USER_IDS.aisha)?.status).toBe('deactivated');
  });
});
