import type { UpdateStatus } from '@bemmoly/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpdatesPage } from '../pages/settings/updates-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { rollbackCopy, updateModeCopy } from './use-updates-copy.ts';
import { useUpdates } from './use-updates.ts';

const previous = (patch: Partial<NonNullable<UpdateStatus['previous']>>) => ({
  version: '1.2.4',
  updatedAt: '2026-10-07T09:02:00.000Z',
  availableUntil: '2026-10-14T09:02:00.000Z',
  rollbackMode: 'code' as const,
  discardCount: null,
  droppedFields: [],
  ...patch,
});

describe('rollback copy', () => {
  it('says a code rollback loses nothing', () => {
    const copy = rollbackCopy(previous({}));
    expect(copy.mode).toBe('Code rollback');
    expect(copy.body).toMatch(/nothing is lost/);
    expect(copy.exportSince).toBeNull();
  });

  it('lists the fields a schema rollback drops', () => {
    const copy = rollbackCopy(
      previous({ rollbackMode: 'schema', droppedFields: ['issues.risk_score', 'pages.template'] }),
    );
    expect(copy.mode).toBe('Schema rollback');
    expect(copy.body).toContain('issues.risk_score, pages.template');
  });

  it('counts what a restore rollback discards and offers the audit export', () => {
    const copy = rollbackCopy(previous({ rollbackMode: 'restore', discardCount: 142 }));
    expect(copy.mode).toBe('Restore rollback');
    expect(copy.body).toMatch(/Restoring 1\.2\.4 will discard 142 changes made since/);
    expect(copy.exportSince).toBe('2026-10-07T09:02:00.000Z');
  });

  it('describes each update mode', () => {
    expect(updateModeCopy('in_app')).toMatch(/backs up first, then swaps/);
    expect(updateModeCopy('cli')).toMatch(/Run this on the server/);
    expect(updateModeCopy('kubernetes')).toMatch(/Helm release/);
  });
});

describe('updates', () => {
  it('starts an update and polls the job to its result', async () => {
    const { result } = await renderQueryHook(() => useUpdates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.apply.mutate('0.1.2'));
    await waitFor(() => expect(result.current.status?.job?.state).toBe('running'));
    expect(result.current.busy).toBe(true);
    await waitFor(() => expect(result.current.status?.job?.state).toBe('succeeded'), {
      timeout: 4000,
    });
    expect(result.current.status?.currentVersion).toBe('0.1.2');
    expect(mockApi.db.updates.previous?.version).toBe('0.1.1');
  });

  it('renders the release and confirms a rollback in a dialog naming the mode', async () => {
    await renderPage(() => <UpdatesPage />);
    expect(await screen.findByText('Update to 0.1.2')).toBeTruthy();
    expect(screen.getByText(/Fixes the invite email link/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Roll back to 0.1.0' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Code rollback')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roll back to 0.1.0' }));
    await waitFor(() => expect(mockApi.db.updates.job?.action).toBe('rollback'));
  });

  it('shows the command instead of the button when updates run from the CLI', async () => {
    mockApi.db.updates.mode = 'cli';
    mockApi.db.updates.command = 'sudo bemmoly update 0.1.2';
    await renderPage(() => <UpdatesPage />);
    expect(await screen.findByText('sudo bemmoly update 0.1.2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update to 0.1.2' })).toBeNull();
  });

  it('switches the channel through the setting', async () => {
    const { result } = await renderQueryHook(() => useUpdates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.setChannel('beta'));
    await waitFor(() => expect(result.current.status?.channel).toBe('beta'));
    expect(mockApi.db.settings['updates.channel']).toBe('beta');
    expect(result.current.channel).toBe('beta');
  });
});
