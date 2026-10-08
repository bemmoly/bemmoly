import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import {
  IMPORT_NOTICE,
  IMPORT_SOURCES,
  importSummary,
  useSetupImport,
} from './use-setup-import.ts';

beforeEach(() => useSetupStore.getState().reset());

describe('import step', () => {
  it('shows every importer as coming soon and leaves Start clean as the one choice', () => {
    const open = IMPORT_SOURCES.filter((source) => !source.comingSoon).map((source) => source.id);
    expect(open).toEqual(['clean']);
    expect(IMPORT_NOTICE).toContain('later from Settings');
    expect(IMPORT_NOTICE).not.toContain('Skip for now');
  });

  it('starts with Start clean picked, so Continue can start', () => {
    const { result } = renderHook(() => useSetupImport(() => undefined));
    expect(result.current.selected).toBe('clean');
    expect(result.current.canStart).toBe(true);
    expect(result.current.label).toBe('Continue');
  });

  it('records Start clean on Continue and moves on', () => {
    const next = vi.fn();
    const { result } = renderHook(() => useSetupImport(next));
    act(() => result.current.start());
    expect(next).toHaveBeenCalledTimes(1);
    expect(useSetupStore.getState().importSource).toBe('clean');
    expect(importSummary(useSetupStore.getState().importSource)).toBe('Start clean');
  });
});
