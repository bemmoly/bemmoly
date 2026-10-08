import { ApiError } from '@bemmoly/api-client';
import type { RollbackPlan } from '@bemmoly/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UpdatesPage } from '../pages/settings/updates-page.tsx';
import { channelRisk, useUpdateSettings } from './use-updates-settings.ts';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { commandFrom, releaseWarnings, rollbackCopy, updateModeCopy } from './use-updates-copy.ts';
import { useUpdates } from './use-updates.ts';

const plan = (patch: Partial<RollbackPlan>): RollbackPlan => ({
  fromVersion: '1.3.0',
  toVersion: '1.2.4',
  mode: 'code',
  summary: 'Swaps back to the 1.2.4 image.',
  reason: 'compatible',
  schemaChangesets: [],
  discard: null,
  backupId: null,
  expiresAt: null,
  ...patch,
});

describe('rollback copy', () => {
  it('says a code rollback loses nothing', () => {
    const copy = rollbackCopy(plan({}));
    expect(copy.mode).toBe('Code rollback');
    expect(copy.details.join(' ')).toMatch(/Nothing is lost/);
    expect(copy.exportSince).toBeNull();
  });

  it('lists the schema changes a schema rollback reverses', () => {
    const copy = rollbackCopy(
      plan({
        mode: 'schema',
        schemaChangesets: [
          { module: 'work', id: '0031-risk-score' },
          { module: 'docs', id: '0012-templates' },
        ],
      }),
    );
    expect(copy.mode).toBe('Schema rollback');
    expect(copy.details[0]).toBe(
      'Reverses 2 schema changes: work/0031-risk-score, docs/0012-templates.',
    );
  });

  it('counts what a restore rollback discards and offers the audit export', () => {
    const since = '2026-10-07T09:02:00.000Z';
    const copy = rollbackCopy(
      plan({ mode: 'restore', discard: { changes: 142, people: 11, since } }),
    );
    expect(copy.mode).toBe('Restore rollback');
    expect(copy.details[0]).toMatch(
      /^Restoring 1\.2\.4 will discard 142 changes made since .+ by 11 people\.$/,
    );
    expect(copy.exportSince).toBe(since);
  });

  it('describes each updater mode and reads the CLI command from a 409', () => {
    expect(updateModeCopy('in_app')).toMatch(/backs up first, then swaps/);
    expect(updateModeCopy('cli')).toMatch(/Run this on the server/);
    const error = new ApiError(409, 'conflict', 'no updater', {
      details: { command: 'sudo bemmoly upgrade 0.1.2' },
    });
    expect(commandFrom(error)).toBe('sudo bemmoly upgrade 0.1.2');
    expect(commandFrom(new ApiError(409, 'conflict', 'x'))).toBeNull();
  });

  it('lists slow changesets and config changes before confirming', () => {
    const release = mockApi.db.updates.available;
    if (!release) throw new Error('the ready scenario seeds an available update');
    const warnings = releaseWarnings(release);
    expect(warnings.map((warning) => warning.items)).toEqual([
      ['kernel/0014-audit-log-actor-index: Adds an index on the audit log by actor'],
      ['New: BEMMOLY_BACKUP_PARALLELISM'],
    ]);
  });
});

describe('updates', () => {
  it('says the release list was never fetched, and fetches it on "Check for updates"', async () => {
    mockApi.db.updates.checks = { ...mockApi.db.updates.checks, lastCheckedAt: null };
    mockApi.db.updates.available = null;
    await renderPage(UpdatesPage);
    expect(await screen.findByText(/has not been fetched yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText(/You are on the latest stable release/)).toBeTruthy();
    expect(mockApi.db.updates.checks.lastCheckedAt).not.toBeNull();
  });

  it('starts an update, polls the updater, and offers the rollback afterwards', async () => {
    const { result } = await renderQueryHook(() => useUpdates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.apply.mutate('0.1.2'));
    await waitFor(() => expect(result.current.running).toBe(true));
    await waitFor(() => expect(result.current.overview?.current.version).toBe('0.1.2'), {
      timeout: 5000,
    });
    expect(result.current.running).toBe(false);
    expect(result.current.overview?.rollback?.toVersion).toBe('0.1.1');
  });

  it('shows the command when the install has no updater', async () => {
    mockApi.db.updates.updater.mode = 'cli';
    await renderPage(() => <UpdatesPage />);
    expect(await screen.findByText('sudo bemmoly upgrade 0.1.2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update to 0.1.2' })).toBeNull();
  });

  it('confirms a rollback in a dialog naming the mode', async () => {
    await renderPage(() => <UpdatesPage />);
    expect(await screen.findByText('Release notes for 0.1.2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Roll back to 0.1.0' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Code rollback')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roll back to 0.1.0' }));
    await waitFor(() => expect(mockApi.db.updates.updater.step).toBe('rollback'));
  });

  it('shows the new plan when it changed before confirming', async () => {
    const { result } = await renderQueryHook(() => useUpdates());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.dialog.open('rollback'));
    act(() => result.current.rollback.mutate('restore'));
    await waitFor(() => expect(result.current.planChanged).toBe(true));
    expect(mockApi.db.updates.updater.state).toBe('idle');
  });

  it('switches the channel through the setting and asks first', async () => {
    const { result } = await renderQueryHook(() => {
      const updates = useUpdates();
      return { updates, settings: useUpdateSettings(updates.overview) };
    });
    await waitFor(() => expect(result.current.settings.value).toBeDefined());
    const stored = result.current.settings.stored ?? { channel: 'stable', checkDaily: true };
    expect(channelRisk(stored, stored)).toBeNull();
    expect(channelRisk(stored, { ...stored, channel: 'beta' })?.confirmLabel).toBe(
      'Switch to beta',
    );
    act(() => result.current.settings.update({ channel: 'beta' }));
    expect(result.current.settings.dirty).toBe(true);
    let saved = false;
    act(() => result.current.settings.save(() => (saved = true)));
    await waitFor(() => expect(saved).toBe(true));
    expect(mockApi.db.settings['system.updates.channel']).toBe('beta');
    await waitFor(() => expect(result.current.updates.overview?.current.channel).toBe('beta'));
  });
});
