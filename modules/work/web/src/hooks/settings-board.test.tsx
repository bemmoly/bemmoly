import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveStatus, removeColumn, setWip } from '../settings/model/columns.ts';
import { S } from '../settings/model/fixtures.ts';
import { createFakeWork } from './settings-fakes.ts';

const holder = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof createFakeWork> }));

vi.mock('../shared/api.ts', () => ({
  api: {
    get work() {
      return holder.fake.work;
    },
    auth: { me: async () => ({ capabilities: ['work.board.wip'] }) },
  },
  realtimeUrl: () => 'ws://localhost/ws',
}));

const { useBoardSettings } = await import('./settings-board.ts');
const { useSettingsAccess } = await import('./settings-access.ts');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function loaded() {
  const hook = renderHook(() => useBoardSettings('PLT'), { wrapper });
  await waitFor(() => expect(hook.result.current.value).not.toBeNull());
  await waitFor(() => expect(hook.result.current.orgConfig).not.toBeNull());
  return hook;
}

describe('useBoardSettings', () => {
  beforeEach(() => {
    holder.fake = createFakeWork();
  });

  it('compares the board with the org default matched by status name', async () => {
    const { result } = await loaded();
    expect(result.current.overrides.map((row) => [row.label, row.after])).toEqual([
      ['Column "In progress"', 'In progress · WIP 4'],
    ]);
    expect(result.current.orgConfig?.columns[0]?.statusIds).toEqual([S['Backlog'], S['Selected']]);
  });

  it('saves one tab and keeps the draft of another', async () => {
    const { result } = await loaded();
    act(() => result.current.updateConfig((config) => ({ ...config, estimationUnit: 'hours' })));
    act(() =>
      result.current.updateConfig((config) => ({
        ...config,
        quickFilters: [{ name: 'Mine', query: 'assignee = me' }],
      })),
    );
    expect(result.current.dirty).toMatchObject({ method: true, filters: true, columns: false });
    const prepared = result.current.prepare('filters');
    expect(prepared?.changes.map((row) => row.label)).toEqual(['Quick filter "Mine"']);
    if (prepared) act(() => result.current.save.mutate(prepared));
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    const sent = holder.fake.writes.board[0] as { config: { estimationUnit: string } };
    expect(sent.config.estimationUnit).toBe('points');
    await waitFor(() => expect(result.current.dirty.filters).toBe(false));
    expect(result.current.dirty.method).toBe(true);
  });

  it('asks before columns that hide cards and blocks bad LQL', async () => {
    const { result } = await loaded();
    act(() => result.current.updateConfig((config) => removeColumn(config, 'qa')));
    expect(result.current.prepare('columns')?.risk?.title).toBe('Take 2 issues off the board?');
    act(() => result.current.discard('columns'));
    act(() => result.current.updateConfig((config) => moveStatus(config, S['Testing']!, 'review')));
    expect(result.current.prepare('columns')?.risk).toBeNull();
    act(() =>
      result.current.updateConfig((config) => ({
        ...config,
        colorRules: [{ query: 'nope = 1', color: '#d93838' }],
      })),
    );
    expect(result.current.prepare('cards')?.problems).toEqual(['Unknown field "nope"']);
  });

  it('switches the method through the project and asks when Kanban turns Scrum', async () => {
    holder.fake = createFakeWork('kanban');
    const { result } = await loaded();
    act(() => result.current.update((draft) => ({ ...draft, method: 'scrum' })));
    const prepared = result.current.prepare('method');
    expect(prepared?.risk?.title).toBe('Switch this board to Scrum?');
    expect(prepared?.changes[0]).toMatchObject({
      label: 'Method',
      before: 'Kanban',
      after: 'Scrum',
    });
    if (prepared) act(() => result.current.save.mutate(prepared));
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    expect(holder.fake.writes.project).toEqual([{ method: 'scrum' }]);
    expect(holder.fake.writes.board).toEqual([]);
  });

  it('resets to the org default re-pointed at the project statuses', async () => {
    const { result } = await loaded();
    act(() => result.current.updateConfig((config) => setWip(config, 'qa', '2')));
    act(() => result.current.reset.mutate());
    await waitFor(() => expect(result.current.reset.isSuccess).toBe(true));
    const sent = holder.fake.writes.board[0] as { config: { columns: { statusIds: string[] }[] } };
    expect(sent.config.columns[3]?.statusIds).toEqual([S['Testing']]);
    expect(result.current.dirty.columns).toBe(false);
  });
});

describe('useSettingsAccess', () => {
  it('lets "Edit WIP limits" alone change WIP limits only', async () => {
    const { result } = renderHook(() => useSettingsAccess(), { wrapper });
    await waitFor(() => expect(result.current.editWip).toBe(true));
    expect(result.current).toEqual({
      configureBoard: false,
      editWip: true,
      configureProject: false,
    });
  });
});
