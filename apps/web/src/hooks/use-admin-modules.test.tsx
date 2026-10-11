import type { AdminModule } from '@bemmoly/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModulesPage } from '../pages/settings/modules-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { TEAM_IDS } from '../mocks/seed/people.ts';
import { mockApi } from '../test/setup.ts';
import { canRemoveData, useAdminModules } from './use-admin-modules.ts';
import { useModules } from './use-modules.ts';

const sample = (): AdminModule => {
  const found = mockApi.db.adminModules.find((module) => module.id === 'sample');
  if (!found) throw new Error('the ready scenario seeds the sample module');
  return found;
};

describe('admin modules', () => {
  it('disables and enables a module, and the navigation modules follow', async () => {
    const { result } = await renderQueryHook(() => ({
      admin: useAdminModules(),
      nav: useModules(),
    }));
    await waitFor(() => expect(result.current.admin.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.nav.data?.map((m) => m.id)).toContain('sample'));

    act(() => result.current.admin.setEnabled.mutate({ id: 'sample', enabled: false }));
    await waitFor(() => expect(result.current.admin.setEnabled.isSuccess).toBe(true));
    expect(sample().enabled).toBe(false);
    expect(result.current.admin.modules[0]?.enabled).toBe(false);
    await waitFor(() => expect(result.current.nav.data?.map((m) => m.id)).not.toContain('sample'));

    act(() => result.current.admin.setEnabled.mutate({ id: 'sample', enabled: true }));
    await waitFor(() => expect(sample().enabled).toBe(true));
    await waitFor(() => expect(result.current.nav.data?.map((m) => m.id)).toContain('sample'));
    expect(result.current.admin.modules[0]?.enabled).toBe(true);
  });

  it('asks who can use a module before enabling it, nobody by default', async () => {
    sample().enabled = false;
    mockApi.db.grants = [];
    await renderPage(() => <ModulesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable Sample' }));
    expect(await screen.findByText('Who can use Sample?')).toBeTruthy();
    expect(screen.getByText(/Users › Module access/)).toBeTruthy();
    const nobody = screen.getByRole('radio', { name: /Nobody yet/ });
    expect(nobody.getAttribute('aria-checked')).toBe('true');

    // The table's button and the dialog's share a name; the dialog's comes last.
    const confirm = () => screen.getAllByRole('button', { name: 'Enable Sample' }).at(-1)!;
    fireEvent.click(screen.getByRole('radio', { name: /Specific teams/ }));
    expect(confirm().hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('combobox', { name: 'Add a team' }));
    fireEvent.click(screen.getByRole('option', { name: 'Mobile' }));
    expect(screen.getByRole('button', { name: 'Remove Mobile' })).toBeTruthy();
    fireEvent.click(confirm());
    await waitFor(() => expect(sample().enabled).toBe(true));
    expect(mockApi.db.grants.map((grant) => [grant.subjectKind, grant.subjectId])).toEqual([
      ['team', TEAM_IDS.mobile],
    ]);
  });

  it('enables with no grants when the admin keeps Nobody yet', async () => {
    sample().enabled = false;
    mockApi.db.grants = [];
    const { result } = await renderQueryHook(() => useAdminModules());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.dialog.open('enable', 'sample'));
    expect(result.current.access.choice).toEqual({ mode: 'none' });
    act(() =>
      result.current.setEnabled.mutate({
        id: 'sample',
        enabled: true,
        access: result.current.access.choice,
      }),
    );
    await waitFor(() => expect(result.current.setEnabled.isSuccess).toBe(true));
    expect(sample().enabled).toBe(true);
    expect(mockApi.db.grants).toEqual([]);
  });

  it('reports a pinned set and leaves it unchanged', async () => {
    mockApi.db.modulesPinned = true;
    const { result } = await renderQueryHook(() => useAdminModules());
    await waitFor(() => expect(result.current.pinned).toBe(true));
    act(() => result.current.setEnabled.mutate({ id: 'sample', enabled: false }));
    await waitFor(() => expect(result.current.setEnabled.isError).toBe(true));
    expect(sample().enabled).toBe(true);
  });

  it('shows the page read-only with the BEMMOLY_MODULES notice when pinned', async () => {
    mockApi.db.modulesPinned = true;
    await renderPage(() => <ModulesPage />);
    expect(await screen.findByText(/BEMMOLY_MODULES is set on the server/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /disable sample/i })).toBeNull();
    expect(screen.getAllByText('Set by BEMMOLY_MODULES')).toHaveLength(3);
  });

  it('allows removing data only when unpinned, disabled and the id is typed exactly', () => {
    const off = { ...sample(), enabled: false };
    expect(canRemoveData(off, 'sample', false)).toBe(true);
    expect(canRemoveData(off, ' sample ', false)).toBe(true);
    expect(canRemoveData(off, 'Sample', false)).toBe(false);
    expect(canRemoveData(off, 'samp', false)).toBe(false);
    expect(canRemoveData(off, 'sample', true)).toBe(false);
    expect(canRemoveData({ ...off, enabled: true }, 'sample', false)).toBe(false);
  });

  it('removes a disabled module’s data after the typed confirmation', async () => {
    sample().enabled = false;
    const { result } = await renderQueryHook(() => useAdminModules());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.dialog.open('remove', 'sample'));
    expect(result.current.dialog.canRemove).toBe(false);
    act(() => result.current.dialog.setTyped('sample'));
    expect(result.current.dialog.canRemove).toBe(true);
    act(() => result.current.removeData.mutate({ id: 'sample', confirm: 'sample' }));
    await waitFor(() => expect(result.current.removeData.isSuccess).toBe(true));
    expect(sample().changelogState).toBe('removed');
    expect(result.current.dialog.kind).toBeNull();
  });

  it('refuses to remove data from an enabled module', async () => {
    const { result } = await renderQueryHook(() => useAdminModules());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.removeData.mutate({ id: 'sample', confirm: 'sample' }));
    await waitFor(() => expect(result.current.removeData.isError).toBe(true));
    expect(sample().changelogState).toBe('current');
  });
});
