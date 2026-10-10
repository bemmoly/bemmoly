import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setSearchParams, useSearchParam, useSearchParamIs, useSearchSlice } from './url-state.ts';

beforeEach(() => window.history.replaceState(null, '', '/work/board/PLT'));

/** Renders a hook and counts its renders. */
function counted<T>(hook: () => T) {
  let renders = 0;
  const result = renderHook(() => {
    renders += 1;
    return hook();
  });
  return { result: result.result, renders: () => renders };
}

describe('url state', () => {
  it('re-renders a parameter reader only when its own parameter changes', () => {
    const issue = counted(() => useSearchParam('issue'));
    act(() => setSearchParams({ q: 'login' }));
    expect(issue.renders()).toBe(1);
    act(() => setSearchParams({ issue: 'PLT-4' }));
    expect(issue.result.current).toBe('PLT-4');
    expect(issue.renders()).toBe(2);
  });

  it('re-renders a row only when it becomes or stops being the open issue', () => {
    const four = counted(() => useSearchParamIs('issue', 'PLT-4'));
    const nine = counted(() => useSearchParamIs('issue', 'PLT-9'));
    act(() => setSearchParams({ issue: 'PLT-4' }));
    act(() => setSearchParams({ issue: 'PLT-5' }));
    expect(four.result.current).toBe(false);
    expect(four.renders()).toBe(3);
    expect(nine.renders()).toBe(1);
  });

  it('reads a slice of the parameters that ignores the others', () => {
    const filters = counted(() => useSearchSlice(['q', 'type']));
    act(() => setSearchParams({ issue: 'PLT-4', group: 'none' }));
    expect(filters.renders()).toBe(1);
    act(() => setSearchParams({ type: 'bug', q: 'login' }));
    expect(filters.result.current).toBe('q=login&type=bug');
  });
});
