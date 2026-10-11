import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { useStarterModules } from './use-starter-modules.ts';

const turnOff = (...ids: string[]) => {
  for (const module of mockApi.db.adminModules) if (ids.includes(module.id)) module.enabled = false;
};
const enabled = (id: string) => mockApi.db.adminModules.find((module) => module.id === id)?.enabled;

describe('starter modules', () => {
  it('turns on Work, then Docs, with nobody granted', async () => {
    turnOff('work', 'docs');
    mockApi.db.grants = [];
    const { result } = await renderQueryHook(() => useStarterModules(true));
    await waitFor(() => expect(result.current.available).toBe(true));
    act(() => result.current.turnOn());
    await waitFor(() => expect(enabled('docs')).toBe(true));
    expect(enabled('work')).toBe(true);
    expect(mockApi.db.grants.filter((grant) => ['work', 'docs'].includes(grant.moduleId))).toEqual(
      [],
    );
    await waitFor(() => expect(result.current.available).toBe(false));
  });

  it('is not offered while the image pins the module set', async () => {
    turnOff('work', 'docs');
    mockApi.db.modulesPinned = true;
    const { result } = await renderQueryHook(() => useStarterModules(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.available).toBe(false);
  });

  it('is not offered to someone who cannot manage modules', async () => {
    turnOff('work', 'docs');
    const { result } = await renderQueryHook(() => useStarterModules(false));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.available).toBe(false);
  });

  it('is not offered once Work and Docs are both on', async () => {
    const { result } = await renderQueryHook(() => useStarterModules(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.available).toBe(false);
  });
});
