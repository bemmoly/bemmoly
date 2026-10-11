import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/setup.ts';
import { renderQueryHook } from '../test/render.tsx';
import { useSetupStore } from '../store/setup.ts';
import { IMPORT_WAITING_NOTICE, importSummary, useSetupImport } from './use-setup-import.ts';

beforeEach(() => useSetupStore.getState().reset());

describe('import step', () => {
  it('offers the enabled modules’ importers beside Start clean, which starts picked', async () => {
    const { result } = await renderQueryHook(() => useSetupImport(() => undefined));
    await waitFor(() => expect(result.current.flow.items.length).toBeGreaterThan(0));
    const ids = result.current.cards.map((card) => card.id);
    expect(ids).toEqual(expect.arrayContaining(['jira', 'csv']));
    expect(ids.at(-1)).toBe('clean');
    expect(result.current.cards.every((card) => !card.unavailable)).toBe(true);
    expect(result.current.selected).toBe('clean');
    expect(result.current.label).toBe('Continue');
  });

  it('shows the importers as waiting while no module offers one', async () => {
    for (const module of mockApi.db.adminModules) module.enabled = false;
    const { result } = await renderQueryHook(() => useSetupImport(() => undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const waiting = result.current.cards.filter((card) => card.unavailable);
    expect(waiting.map((card) => card.unavailable)).toEqual([
      'Needs Work',
      'Needs Docs',
      'Needs Work',
    ]);
    expect(result.current.notice).toBe(IMPORT_WAITING_NOTICE);
    expect(result.current.canStart).toBe(true);
  });

  it('picks a source for the connection form and records Start clean on Continue', async () => {
    const next = vi.fn();
    const { result } = await renderQueryHook(() => useSetupImport(next));
    await waitFor(() => expect(result.current.flow.items.length).toBeGreaterThan(0));
    act(() => result.current.select('csv'));
    expect(result.current.selected).toBe('csv');
    expect(result.current.flow.step).toBe('connect');
    act(() => result.current.select('clean'));
    act(() => result.current.start());
    expect(next).toHaveBeenCalledTimes(1);
    expect(useSetupStore.getState().importSource).toBe('clean');
    expect(importSummary('clean')).toBe('Start clean');
    expect(importSummary('jira')).toContain('Settings › Import');
  });
});
