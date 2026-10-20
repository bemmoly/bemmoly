import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveStatus, removeColumn, setWip } from '../settings/model/columns.ts';
import { S } from '../settings/model/fixtures.ts';
import { ORG_SCOPE, projectScope } from '../settings/pages.ts';
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
const { orgDefaultsAccess, useSettingsAccess } = await import('./settings-access.ts');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function loaded() {
  const hook = renderHook(() => useBoardSettings(projectScope('PLT')), { wrapper });
  await waitFor(() => expect(hook.result.current.value).not.toBeNull());
  await waitFor(() => expect(hook.result.current.baseConfig).not.toBeNull());
  return hook;
}

describe('useBoardSettings', () => {
  beforeEach(() => {
    holder.fake = createFakeWork();
  });

  it("counts only this project's issues, though the workflow may be shared", async () => {
    await loaded();
    await waitFor(() => expect(holder.fake.writes.counts).toHaveLength(1));
    expect(holder.fake.writes.counts[0]).toEqual([
      '00000000-0000-7000-8000-0000000000c1',
      holder.fake.project.id,
    ]);
  });

  it('compares the board with the org default matched by status name', async () => {
    const { result } = await loaded();
    expect(result.current.overrides.map((row) => [row.label, row.after])).toEqual([
      ['Column "In progress"', 'In progress · WIP 4'],
    ]);
    expect(result.current.baseConfig?.columns[0]?.statusIds).toEqual([S['Backlog'], S['Selected']]);
  });

  it("compares with Work's default board when the org has no board scheme", async () => {
    holder.fake = createFakeWork('scrum', { withOrgBoard: false });
    const { result } = await loaded();
    expect(result.current.baseName).toBe('the default board');
    // The default is one column per open status, then Done; the board differs in its columns.
    expect(result.current.baseConfig?.columns.map((column) => column.name)).toEqual([
      ...result.current.statuses.filter((s) => s.category !== 'done').map((s) => s.name),
      'Done',
    ]);
    expect(result.current.baseConfig?.cardFields).toEqual([
      'type',
      'key',
      'priority',
      'labels',
      'estimate',
      'assignee',
    ]);
    const before = result.current.overrides.length;
    expect(before).toBeGreaterThan(0);
    // A saved card layout is a change from the default, and the note counts it.
    act(() =>
      result.current.updateConfig((config) => ({
        ...config,
        cardFields: ['type', 'key', 'labels', 'estimate', 'due'],
        colorRule: 'priority',
      })),
    );
    const prepared = result.current.prepare('cards');
    if (prepared) act(() => result.current.save.mutate(prepared));
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.overrides.length).toBe(before + 2));
    expect(result.current.overrides.map((row) => row.label)).toEqual(
      expect.arrayContaining(['Card fields', 'Card color']),
    );
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

  it('resets through the scheme, so the project follows the org default again', async () => {
    const { result } = await loaded();
    act(() => result.current.updateConfig((config) => setWip(config, 'qa', '2')));
    act(() => result.current.reset.mutate());
    await waitFor(() => expect(result.current.reset.isSuccess).toBe(true));
    expect(holder.fake.writes.reset).toEqual([[holder.fake.project.id, 'board']]);
    expect(holder.fake.writes.board).toEqual([]);
    expect(result.current.dirty.columns).toBe(false);
    await waitFor(() => expect(result.current.overrides).toEqual([]));
  });

  it('edits the org default board itself, with nothing to compare it with', async () => {
    const hook = renderHook(() => useBoardSettings(ORG_SCOPE), { wrapper });
    await waitFor(() => expect(hook.result.current.value).not.toBeNull());
    const { result } = hook;
    expect(result.current.project).toBeUndefined();
    expect(result.current.board?.projectId).toBeNull();
    expect(result.current.baseConfig).toBeNull();
    expect(result.current.workflowHref).toBe('/settings/work/workflow');
    expect(result.current.value?.config.columns[0]?.statusIds[0]).toMatch(/0001\d\d$/);
    act(() =>
      result.current.updateConfig((config) => ({
        ...config,
        quickFilters: [{ name: 'Blocked', query: 'status = Blocked' }],
      })),
    );
    const prepared = result.current.prepare('filters');
    if (prepared) act(() => result.current.save.mutate(prepared));
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    expect(holder.fake.writes.orgBoard).toHaveLength(1);
    expect(holder.fake.writes.board).toEqual([]);
    expect(holder.fake.writes.project).toEqual([]);
    expect(holder.fake.writes.counts).toEqual([]);
    expect(holder.fake.writes.fields).toContain(null);
  });
});

describe('useSettingsAccess', () => {
  it('lets "Edit WIP limits" alone change WIP limits only', async () => {
    const { result } = renderHook(() => useSettingsAccess(), { wrapper });
    await waitFor(() => expect(result.current.editWip).toBe(true));
    expect(result.current).toEqual({
      orgAdmin: false,
      configureBoard: false,
      editWip: true,
      configureProject: false,
      manageInitiatives: false,
    });
    expect(orgDefaultsAccess(result.current)).toEqual({
      orgAdmin: false,
      configureBoard: false,
      editWip: false,
      configureProject: false,
      manageInitiatives: false,
    });
  });

  it('gives a workspace admin the org defaults, never a project method', () => {
    const admin = {
      orgAdmin: true,
      configureBoard: true,
      editWip: true,
      configureProject: true,
      manageInitiatives: true,
    };
    expect(orgDefaultsAccess(admin)).toEqual({
      orgAdmin: true,
      configureBoard: true,
      editWip: true,
      configureProject: false,
      manageInitiatives: true,
    });
  });
});
