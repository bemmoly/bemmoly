import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEAM_IDS } from '../mocks/seed/people.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { grantLabel, moduleLabel, useModuleAccess } from './use-module-access.ts';

describe('module access editor', () => {
  it('names modules and grants in plain words', () => {
    expect(moduleLabel('docs', [])).toBe('Docs');
    const work = {
      id: 'work',
      version: '0.2.0',
      navigation: [{ id: 'work.board', label: 'Board', path: '/work/board', placement: 'top' }],
    } as const;
    expect(moduleLabel('work', [{ ...work, navigation: [...work.navigation] }])).toBe('Work');
    expect(moduleLabel('work', [{ ...work, name: 'Work items', navigation: [] }])).toBe(
      'Work items',
    );
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
    const docs = () => result.current.sections.find((section) => section.id === 'docs');
    await waitFor(() => expect(docs()?.grants).toHaveLength(1));
    expect(docs()?.grants[0]?.label).toBe('Everyone');
    expect(result.current.everyoneGranted('docs')).toBe(true);

    act(() => result.current.setDraft('docs', { kind: 'team' }));
    await waitFor(() => expect(result.current.subjectOptions('docs', 'team')).toHaveLength(6));
    act(() => result.current.setDraft('docs', { subjectId: TEAM_IDS.mobile }));
    act(() => result.current.submit('docs'));
    await waitFor(() => expect(docs()?.grants).toHaveLength(2));
    expect(result.current.subjectOptions('docs', 'team')).toHaveLength(5);
    expect(mockApi.db.grants.at(-1)).toMatchObject({
      moduleId: 'docs',
      subjectKind: 'team',
      subjectId: TEAM_IDS.mobile,
    });

    const everyone = docs()?.grants.find((g) => g.subjectKind === 'everyone');
    act(() => result.current.remove.mutate(everyone!));
    await waitFor(() => expect(docs()?.grants).toHaveLength(1));
    expect(
      mockApi.db.grants.some((g) => g.moduleId === 'docs' && g.subjectKind === 'everyone'),
    ).toBe(false);
  });
});
