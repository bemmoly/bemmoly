import { act, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { ROLE_IDS, USER_IDS } from '../mocks/seed/people.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { useCreateTeam, useTeams } from './use-teams.ts';

describe('teams', () => {
  it('joins each team with its lead, default role and members', async () => {
    const { result } = await renderQueryHook(() => useTeams());
    await waitFor(() => expect(result.current.cards[1]?.people).toHaveLength(2));
    const mobile = result.current.cards[1];
    expect(mobile).toMatchObject({
      name: 'Mobile',
      initials: 'MO',
      lead: 'Jonas M.',
      memberCount: 6,
      defaultRole: 'Member',
    });
    expect(mobile?.people.map((person) => person.name)).toEqual(['Jonas M.', 'Dev P.']);
    expect(result.current.cards.at(-1)?.defaultRole).toBe('Viewer');
  });

  it('creates a team with a lead and the Viewer default role', async () => {
    let done = false;
    const { result } = await renderQueryHook(() => useCreateTeam(() => (done = true)));
    await waitFor(() => expect(result.current.form.defaultRoleId).toBe(ROLE_IDS.viewer));
    act(() => result.current.submit({ preventDefault: () => undefined } as FormEvent));
    expect(result.current.errors['name']).toBeTruthy();
    act(() => result.current.update({ name: 'Data', leadUserId: USER_IDS.aisha }));
    act(() => result.current.submit({ preventDefault: () => undefined } as FormEvent));
    await waitFor(() => expect(done).toBe(true));
    expect(mockApi.db.teams.at(-1)).toMatchObject({
      name: 'Data',
      leadUserId: USER_IDS.aisha,
      defaultRoleId: ROLE_IDS.viewer,
    });
  });
});
