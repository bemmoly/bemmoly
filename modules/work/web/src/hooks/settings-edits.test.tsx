import { LeaveGuardProvider, type LeaveGuardHook } from '@bemmoly/core-web';
import { act, renderHook } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSettingsEdits, type EditSpec } from './settings-edits.ts';

const spec = (title: string, dirty: boolean, discard = vi.fn()): EditSpec => ({
  title,
  dirty,
  discard,
});

/** A shell guard the test drives: `attempt` is a move from the top bar or the sidebar. */
function fakeShell() {
  const shell = { when: false, attempt: () => undefined as void, left: 0 };
  const hook: LeaveGuardHook = ({ when }) => {
    const [blocked, setBlocked] = useState(false);
    shell.when = when;
    shell.attempt = () => (when ? setBlocked(true) : shell.left++);
    return {
      blocked,
      to: blocked ? '/settings/workspace' : null,
      stay: () => setBlocked(false),
      leave: () => {
        setBlocked(false);
        shell.left++;
      },
    };
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LeaveGuardProvider hook={hook}>{children}</LeaveGuardProvider>
  );
  return { shell, wrapper };
}

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

  it("holds a move through the shell's guard while drafts are unsaved", () => {
    const { shell, wrapper } = fakeShell();
    const discardColumns = vi.fn();
    const { result } = renderHook(
      () =>
        useSettingsEdits({
          columns: spec('Columns', true, discardColumns),
          lanes: spec('Swimlanes', true),
        }),
      { wrapper },
    );
    expect(shell.when).toBe(false);
    act(() => shell.attempt());
    expect(shell.left).toBe(1);

    act(() => result.current.edit('columns'));
    act(() => result.current.edit('lanes'));
    expect(shell.when).toBe(true);
    expect(result.current.bar.sections.map((section) => section.title)).toEqual([
      'Columns',
      'Swimlanes',
    ]);
    act(() => shell.attempt());
    expect(result.current.bar.leaving).toBe(true);
    act(() => result.current.bar.onStay?.());
    expect(result.current.bar.leaving).toBe(false);
    expect(shell.left).toBe(1);

    act(() => shell.attempt());
    act(() => result.current.bar.onLeave?.());
    expect(discardColumns).toHaveBeenCalledOnce();
    expect(shell.left).toBe(2);
    expect(result.current.mode('lanes')).toBe('read');
  });
});
