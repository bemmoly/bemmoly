import { LeaveGuardProvider, type LeaveGuardHook } from '@bemmoly/core-web';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SaveState } from './workflow-draft.ts';
import { useDraftLeaveGuard } from './workflow-leave.ts';

/** A shell guard the test drives: `attempt` is a click on a top bar link. */
function fakeShell() {
  const shell = { when: false, attempt: () => undefined as void, left: 0, stayed: 0 };
  const hook: LeaveGuardHook = ({ when }) => {
    const [blocked, setBlocked] = useState(false);
    shell.when = when;
    shell.attempt = () => (when ? setBlocked(true) : shell.left++);
    return {
      blocked,
      to: blocked ? '/work/board' : null,
      stay: () => {
        setBlocked(false);
        shell.stayed++;
      },
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

describe('useDraftLeaveGuard', () => {
  it('lets the move through once the waiting change is saved', async () => {
    const { shell, wrapper } = fakeShell();
    const flush = vi.fn(async () => undefined);
    const { result } = renderHook(
      () => useDraftLeaveGuard({ saveState: 'pending' as SaveState, flush }),
      { wrapper },
    );
    expect(shell.when).toBe(true);
    act(() => shell.attempt());
    await waitFor(() => expect(shell.left).toBe(1));
    expect(flush).toHaveBeenCalledOnce();
    expect(result.current.asking).toBe(false);
  });

  it('asks when the save fails, and stays or leaves as told', async () => {
    const { shell, wrapper } = fakeShell();
    const flush = vi.fn(async () => {
      throw new Error('offline');
    });
    const { result } = renderHook(
      () => useDraftLeaveGuard({ saveState: 'error' as SaveState, flush }),
      { wrapper },
    );
    act(() => shell.attempt());
    await waitFor(() => expect(result.current.asking).toBe(true));
    act(() => result.current.stay());
    expect(shell.stayed).toBe(1);
    expect(result.current.asking).toBe(false);

    act(() => shell.attempt());
    await waitFor(() => expect(result.current.asking).toBe(true));
    act(() => result.current.leave());
    expect(shell.left).toBe(1);
  });

  it('does not hold anything while the draft is saved', () => {
    const { shell, wrapper } = fakeShell();
    renderHook(() => useDraftLeaveGuard({ saveState: 'saved', flush: vi.fn() }), { wrapper });
    act(() => shell.attempt());
    expect(shell.left).toBe(1);
  });
});
