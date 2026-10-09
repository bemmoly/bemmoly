import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSettingsEdits, type EditSpec } from './settings-edits.ts';

const spec = (title: string, dirty: boolean, discard = vi.fn()): EditSpec => ({
  title,
  dirty,
  discard,
});

describe('useSettingsEdits', () => {
  it('opens a section with Edit and discards its draft on Cancel', () => {
    const discard = vi.fn();
    const { result } = renderHook(() =>
      useSettingsEdits({
        columns: spec('Columns', true, discard),
        lanes: spec('Swimlanes', false),
      }),
    );
    expect(result.current.mode('columns')).toBe('read');
    act(() => result.current.edit('columns'));
    expect(result.current.mode('columns')).toBe('edit');
    expect(result.current.unsaved).toEqual(['columns']);
    act(() => result.current.cancel('columns'));
    expect(discard).toHaveBeenCalledOnce();
    expect(result.current.mode('columns')).toBe('read');
  });

  it('lists two unsaved sections and holds a page move until discarded', () => {
    const go = vi.fn();
    const discardColumns = vi.fn();
    const { result } = renderHook(() =>
      useSettingsEdits({
        columns: spec('Columns', true, discardColumns),
        lanes: spec('Swimlanes', true),
      }),
    );
    act(() => result.current.guard(go));
    expect(go).toHaveBeenCalledOnce();
    act(() => result.current.edit('columns'));
    act(() => result.current.edit('lanes'));
    expect(result.current.bar.sections.map((section) => section.title)).toEqual([
      'Columns',
      'Swimlanes',
    ]);
    act(() => result.current.guard(go));
    expect(go).toHaveBeenCalledOnce();
    expect(result.current.bar.leaving).toBe(true);
    act(() => result.current.bar.onStay?.());
    expect(result.current.bar.leaving).toBe(false);
    act(() => result.current.guard(go));
    act(() => result.current.bar.onLeave?.());
    expect(discardColumns).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledTimes(2);
    expect(result.current.mode('lanes')).toBe('read');
  });
});
