import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaveGuardProvider, useLeaveGuard, type LeaveGuardHook } from './leave-guard.tsx';
import { navigateInApp, setShellNavigator } from './navigation.ts';

describe('useLeaveGuard', () => {
  it('asks before the tab closes while `when` holds, with no shell router', () => {
    const { rerender, result } = renderHook(({ when }) => useLeaveGuard({ when }), {
      initialProps: { when: true },
    });
    expect(result.current.blocked).toBe(false);
    const held = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(true);

    rerender({ when: false });
    const free = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(free);
    expect(free.defaultPrevented).toBe(false);
  });

  it("uses the shell's implementation when one is provided", () => {
    const leave = vi.fn();
    const hook: LeaveGuardHook = ({ when }) => ({
      blocked: when,
      to: when ? '/settings' : null,
      stay: () => undefined,
      leave,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LeaveGuardProvider hook={hook}>{children}</LeaveGuardProvider>
    );
    const { result } = renderHook(() => useLeaveGuard({ when: true }), { wrapper });
    expect(result.current).toMatchObject({ blocked: true, to: '/settings' });
    result.current.leave();
    expect(leave).toHaveBeenCalledOnce();
  });
});

describe('navigateInApp', () => {
  afterEach(() => setShellNavigator(null));

  it("goes through the shell's router once it is registered", () => {
    const navigator = vi.fn();
    setShellNavigator(navigator);
    navigateInApp('/work/board');
    expect(navigator).toHaveBeenCalledWith('/work/board', {});
    navigateInApp('/work/board/PLT', { replace: true });
    expect(navigator).toHaveBeenLastCalledWith('/work/board/PLT', { replace: true });
  });

  it('pushes a history entry and a popstate without one', () => {
    const popped = vi.fn();
    window.addEventListener('popstate', popped);
    navigateInApp('/work/backlog');
    window.removeEventListener('popstate', popped);
    expect(window.location.pathname).toBe('/work/backlog');
    expect(popped).toHaveBeenCalledOnce();
  });
});
