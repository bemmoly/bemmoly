import { queryKeys } from '@bemmoly/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderQueryHook, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { initialAdminForm, useSetupAdmin } from './use-setup-admin.ts';

const VALID = {
  workspaceName: 'Acme Labs',
  name: 'Rohan S.',
  email: 'rohan@acme.test',
  password: 'a long enough password',
};

async function fill(
  result: { current: ReturnType<typeof useSetupAdmin> },
  values: Partial<typeof VALID & { workspaceUrl: string }>,
) {
  for (const [field, value] of Object.entries(values)) {
    act(() => result.current.set(field as keyof typeof VALID)(value));
  }
}

describe('useSetupAdmin', () => {
  it('starts the URL at the address the browser used', () => {
    expect(initialAdminForm('https://bemmoly.example').workspaceUrl).toBe(
      'https://bemmoly.example',
    );
  });

  it('shows field errors from the shared schema without calling the server', async () => {
    mockApi.reset('fresh');
    const onCreated = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAdmin(onCreated), testQueryClient());
    await fill(result, { workspaceUrl: 'not a url', password: 'short' });
    act(() => result.current.submit());
    expect(Object.keys(result.current.errors).sort()).toEqual([
      'email',
      'name',
      'password',
      'workspaceName',
      'workspaceUrl',
    ]);
    expect(result.current.mutation.isIdle).toBe(true);
    expect(mockApi.db.initialized).toBe(false);
    act(() => result.current.set('email')('rohan@acme.test'));
    expect(result.current.errors['email']).toBeUndefined();
  });

  it('creates the admin, signs them in and moves on', async () => {
    mockApi.reset('fresh');
    const onCreated = vi.fn();
    const { result, queryClient } = await renderQueryHook(
      () => useSetupAdmin(onCreated),
      testQueryClient(),
    );
    await fill(result, { ...VALID, workspaceUrl: 'https://bemmoly.example/' });
    act(() => result.current.submit());
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.db.initialized).toBe(true);
    expect(mockApi.db.settings['workspace.url']).toBe('https://bemmoly.example');
    expect(queryClient.getQueryData(queryKeys.me())).toMatchObject({
      user: { email: 'rohan@acme.test' },
    });
  });

  it('reports the server refusing a second admin', async () => {
    const onCreated = vi.fn();
    const { result } = await renderQueryHook(() => useSetupAdmin(onCreated), testQueryClient());
    await fill(result, VALID);
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));
    expect(onCreated).not.toHaveBeenCalled();
  });
});
