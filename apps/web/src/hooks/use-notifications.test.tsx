import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi } from '../test/setup.ts';
import { renderQueryHook } from '../test/render.tsx';
import { useInbox, useMarkRead, useNotificationPreferences } from './use-notifications.ts';

describe('inbox hooks', () => {
  it('loads the inbox with its unread count', async () => {
    const { result } = await renderQueryHook(() => useInbox());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The seed's inbox view: ten entries, two of them done.
    expect(result.current.items).toHaveLength(8);
    expect(result.current.unreadCount).toBe(4);
  });

  it('marks one read at once, then everything with read-all', async () => {
    const { result } = await renderQueryHook(() => ({ inbox: useInbox(), marks: useMarkRead() }));
    await waitFor(() => expect(result.current.inbox.isSuccess).toBe(true));
    const first = result.current.inbox.items[0]?.id ?? '';
    act(() => result.current.marks.markRead.mutate(first));
    await waitFor(() => expect(result.current.inbox.unreadCount).toBe(3));
    act(() => result.current.marks.readAll.mutate());
    await waitFor(() => expect(result.current.inbox.unreadCount).toBe(0));
    expect(mockApi.db.notifications.every((item) => item.read)).toBe(true);
  });

  it('saves only the changed preference kinds', async () => {
    const { result } = await renderQueryHook(() => useNotificationPreferences());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.save.mutate({ kinds: { comment: 'off' } }));
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    const comment = mockApi.db.preferences.kinds.find((entry) => entry.kind === 'comment');
    expect(comment?.channel).toBe('off');
    expect(mockApi.db.preferences.kinds.find((entry) => entry.kind === 'mention')?.channel).toBe(
      'email_immediate',
    );
  });
});
