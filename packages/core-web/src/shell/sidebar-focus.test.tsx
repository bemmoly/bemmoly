import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSidebarFocusOwner, useSidebarTakeover } from './sidebar-focus.ts';

describe('sidebar focus', () => {
  it('gives the sidebar to a module while it asks, and takes it back after', () => {
    const owner = renderHook(() => useSidebarFocusOwner());
    const docs = renderHook(({ active }) => useSidebarTakeover('docs', active), {
      initialProps: { active: true },
    });
    owner.rerender();
    expect(owner.result.current).toBe('docs');
    docs.rerender({ active: false });
    owner.rerender();
    expect(owner.result.current).toBeNull();
  });

  it('never lets one module release another module’s hold', () => {
    const owner = renderHook(() => useSidebarFocusOwner());
    const docs = renderHook(() => useSidebarTakeover('docs', true));
    renderHook(() => useSidebarTakeover('work', true));
    docs.unmount();
    owner.rerender();
    expect(owner.result.current).toBe('work');
  });
});
