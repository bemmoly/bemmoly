import { describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api.ts';
import { renderQueryHook } from '../test/render.tsx';
import { useUserSearch } from './use-user-search.ts';

describe('useUserSearch', () => {
  it('finds people on the server', async () => {
    const { result } = await renderQueryHook(() => useUserSearch());
    const found = await result.current('aisha', new AbortController().signal);
    expect(found.map((option) => option.label)).toContain('Aisha K.');
  });

  it('hands the Select signal to the request and passes its AbortError back', async () => {
    const { result } = await renderQueryHook(() => useUserSearch());
    const list = vi
      .spyOn(api.users, 'list')
      .mockRejectedValueOnce(new DOMException('The search was replaced', 'AbortError'));
    const controller = new AbortController();
    const pending = result.current('priya', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'priya' }), {
      signal: controller.signal,
    });
    list.mockRestore();
    const again = await result.current('priya', new AbortController().signal);
    expect(again.map((option) => option.label)).toEqual(['Priya N.']);
  });
});
