import { queryKeys } from '@bemmoly/api-client';
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { renderQueryHook, testQueryClient } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { initialWorkspaceUrl, useSetupAdmin, useSetupWorkspace } from './use-setup-admin.ts';

const ACCOUNT = { name: 'Rohan S.', email: 'rohan@acme.test', password: 'a long enough password' };

beforeEach(() => useSetupStore.getState().reset());

function fillAccount(
  result: { current: ReturnType<typeof useSetupAdmin> },
  values: Partial<typeof ACCOUNT>,
) {
  for (const [field, value] of Object.entries(values)) {
    act(() => result.current.set(field as keyof typeof ACCOUNT)(value));
  }
}

describe('useSetupWorkspace', () => {
  it('starts the URL at the address the browser used', () => {
    expect(initialWorkspaceUrl('https://bemmoly.example')).toBe('https://bemmoly.example');
  });

  it('checks a field on blur and keeps the answers in the draft', async () => {
    const onDone = vi.fn();
    const { result } = await renderQueryHook(() => useSetupWorkspace(onDone), testQueryClient());
    act(() => result.current.set('workspaceUrl')('not a url'));
    act(() => result.current.blur('workspaceUrl')());
    expect(result.current.errors['workspaceUrl']).toBeTruthy();
    act(() => result.current.submit());
    expect(result.current.errors['workspaceName']).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    act(() => result.current.set('workspaceName')('Acme Labs'));
    act(() => result.current.set('workspaceUrl')('https://bemmoly.example/'));
    act(() => result.current.submit());
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(useSetupStore.getState()).toMatchObject({
      workspaceName: 'Acme Labs',
      workspaceUrl: 'https://bemmoly.example',
    });
  });
});

describe('useSetupAdmin', () => {
  it('shows field errors from the shared schema without calling the server', async () => {
    mockApi.reset('fresh');
    useSetupStore.getState().update({ workspaceName: 'Acme Labs' });
    const { result } = await renderQueryHook(
      () => useSetupAdmin(vi.fn(), vi.fn()),
      testQueryClient(),
    );
    fillAccount(result, { password: 'short' });
    act(() => result.current.submit());
    expect(Object.keys(result.current.errors).sort()).toEqual(['email', 'name', 'password']);
    expect(result.current.mutation.isIdle).toBe(true);
    expect(mockApi.db.initialized).toBe(false);
    act(() => result.current.set('email')('rohan@acme.test'));
    expect(result.current.errors['email']).toBeUndefined();
  });

  it('sends a missing workspace back to the first step', async () => {
    mockApi.reset('fresh');
    const onWorkspaceError = vi.fn();
    const { result } = await renderQueryHook(
      () => useSetupAdmin(vi.fn(), onWorkspaceError),
      testQueryClient(),
    );
    fillAccount(result, ACCOUNT);
    act(() => result.current.submit());
    expect(onWorkspaceError).toHaveBeenCalledTimes(1);
    expect(mockApi.db.initialized).toBe(false);
  });

  it('creates the admin with the workspace, signs them in and moves on', async () => {
    mockApi.reset('fresh');
    useSetupStore
      .getState()
      .update({ workspaceName: 'Acme Labs', workspaceUrl: 'https://bemmoly.example/' });
    const onCreated = vi.fn();
    const { result, queryClient } = await renderQueryHook(
      () => useSetupAdmin(onCreated, vi.fn()),
      testQueryClient(),
    );
    fillAccount(result, ACCOUNT);
    act(() => result.current.submit());
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockApi.db.initialized).toBe(true);
    expect(mockApi.db.settings['workspace.url']).toBe('https://bemmoly.example');
    expect(queryClient.getQueryData(queryKeys.me())).toMatchObject({
      user: { email: 'rohan@acme.test' },
    });
  });

  it('reports the server refusing a second admin', async () => {
    useSetupStore.getState().update({ workspaceName: 'Acme Labs' });
    const onCreated = vi.fn();
    const { result } = await renderQueryHook(
      () => useSetupAdmin(onCreated, vi.fn()),
      testQueryClient(),
    );
    fillAccount(result, ACCOUNT);
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));
    expect(result.current.failed).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
