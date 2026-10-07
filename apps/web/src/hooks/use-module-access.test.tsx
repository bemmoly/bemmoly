import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEAM_IDS } from '../mocks/seed/people.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { grantLabel, moduleLabel, useModuleAccess } from './use-module-access.ts';

describe('module access editor', () => {
  it('names modules and grants in plain words', () => {
    expect(moduleLabel('sample', [])).toBe('Sample');
    const names = {
      teams: new Map([[TEAM_IDS.mobile, 'Mobile']]),
      roles: new Map<string, string>(),
      users: new Map<string, string>(),
    };
    const base = { id: 'g', moduleId: 'work', grantedBy: null, createdAt: '' };
    expect(grantLabel({ ...base, subjectKind: 'everyone', subjectId: null }, names)).toBe(
      'Everyone',
    );
    expect(grantLabel({ ...base, subjectKind: 'team', subjectId: TEAM_IDS.mobile }, names)).toBe(
      'Team Mobile',
    );
  });

  it('adds a team grant and removes the everyone grant', async () => {
    const { result } = await renderQueryHook(() => useModuleAccess());
    await waitFor(() => expect(result.current.sections[0]?.grants).toHaveLength(1));
    expect(result.current.sections[0]?.grants[0]?.label).toBe('Everyone');
    expect(result.current.everyoneGranted('sample')).toBe(true);

    act(() => result.current.setDraft('sample', { kind: 'team' }));
    await waitFor(() => expect(result.current.subjectOptions('sample', 'team')).toHaveLength(6));
    act(() => result.current.setDraft('sample', { subjectId: TEAM_IDS.mobile }));
    act(() => result.current.submit('sample'));
    await waitFor(() => expect(result.current.sections[0]?.grants).toHaveLength(2));
    expect(result.current.subjectOptions('sample', 'team')).toHaveLength(5);
    expect(mockApi.db.grants.at(-1)).toMatchObject({
      moduleId: 'sample',
      subjectKind: 'team',
      subjectId: TEAM_IDS.mobile,
    });

    const everyone = result.current.sections[0]?.grants.find((g) => g.subjectKind === 'everyone');
    act(() => result.current.remove.mutate(everyone!));
    await waitFor(() => expect(result.current.sections[0]?.grants).toHaveLength(1));
    expect(mockApi.db.grants.some((g) => g.subjectKind === 'everyone')).toBe(false);
  });
});
