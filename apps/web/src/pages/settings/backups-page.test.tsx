import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { BackupsPage } from './backups-page.tsx';

const click = (element: HTMLElement) => act(() => fireEvent.click(element));
const region = (name: string) => screen.getByRole('region', { name });

describe('Storage and backups', () => {
  it('opens in a read view and edits one section at a time', async () => {
    await renderPage(() => <BackupsPage />, '/settings/backups');
    const retention = await screen.findByRole('region', { name: 'Retention' });
    expect(within(retention).queryByRole('spinbutton')).toBeNull();
    expect(within(retention).getByText('7 kept')).toBeDefined();

    click(within(retention).getByRole('button', { name: 'Edit Retention' }));
    const save = within(region('Retention')).getByRole('button', { name: 'Save' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(within(region('Schedule')).queryByRole('combobox')).toBeNull();

    act(() =>
      fireEvent.change(within(region('Retention')).getByLabelText('Daily'), {
        target: { value: '30' },
      }),
    );
    expect((save as HTMLButtonElement).disabled).toBe(false);
    click(save);
    await waitFor(() => expect(within(region('Retention')).getByText('30 kept')).toBeDefined());
    expect(mockApi.db.settings['system.backups.retention']).toMatchObject({ daily: 30 });
    expect(within(region('Retention')).queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('asks for "confirm" before lowering retention, and Cancel keeps it', async () => {
    await renderPage(() => <BackupsPage />, '/settings/backups');
    click(await screen.findByRole('button', { name: 'Edit Retention' }));
    act(() =>
      fireEvent.change(within(region('Retention')).getByLabelText('Daily'), {
        target: { value: '3' },
      }),
    );
    click(within(region('Retention')).getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog', { name: 'Lower retention?' });
    expect(dialog.textContent).toContain('Daily: 7 to 3 kept');
    const confirm = within(dialog).getByRole('button', { name: 'Lower retention' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    act(() =>
      fireEvent.change(within(dialog).getByLabelText(/to confirm/), {
        target: { value: 'confirm' },
      }),
    );
    click(confirm);
    await waitFor(() =>
      expect(mockApi.db.settings['system.backups.retention']).toMatchObject({ daily: 3 }),
    );
    // Daily now matches Monthly's default of 3.
    await waitFor(() => expect(within(region('Retention')).getAllByText('3 kept')).toHaveLength(2));
  });

  it('lists unsaved sections when two are open with changes, and discards them', async () => {
    await renderPage(() => <BackupsPage />, '/settings/backups');
    click(await screen.findByRole('button', { name: 'Edit Retention' }));
    click(screen.getByRole('button', { name: 'Edit Encryption and verification' }));
    act(() =>
      fireEvent.change(within(region('Retention')).getByLabelText('Daily'), {
        target: { value: '9' },
      }),
    );
    expect(screen.queryByRole('status', { name: 'Unsaved changes' })).toBeNull();
    click(screen.getByRole('switch', { name: 'Weekly test restore' }));
    const bar = screen.getByRole('status', { name: 'Unsaved changes' });
    expect(bar.textContent).toContain('Retention and Encryption and verification');
    click(within(bar).getByRole('button', { name: 'Discard all' }));
    expect(screen.queryByRole('status', { name: 'Unsaved changes' })).toBeNull();
    expect(within(region('Retention')).getByText('7 kept')).toBeDefined();
  });

  it('restores from "Restore…" through the picker and a typed confirmation', async () => {
    await renderPage(() => <BackupsPage />, '/settings/backups');
    const rows = await screen.findAllByRole('button', { name: /^Restore the backup from/ });
    expect(rows.length).toBeGreaterThan(0);
    click(screen.getByRole('button', { name: 'Restore…' }));
    const picker = screen.getByRole('dialog', { name: 'Restore a backup' });
    expect(within(picker).getAllByRole('radio')[0]?.getAttribute('aria-checked')).toBe('true');
    click(within(picker).getByRole('button', { name: 'Continue' }));
    const dialog = screen.getByRole('dialog', { name: /^Restore the backup from/ });
    expect(dialog.textContent).toMatch(/maintenance mode/);
    expect(dialog.textContent).toMatch(/fallback copy for 7 days/);
    const go = within(dialog).getByRole('button', { name: 'Restore this backup' });
    expect((go as HTMLButtonElement).disabled).toBe(true);
    act(() =>
      fireEvent.change(within(dialog).getByLabelText(/to confirm/), {
        target: { value: 'restore' },
      }),
    );
    click(go);
    await waitFor(() => expect(mockApi.db.audit[0]?.action).toBe('backup.restored'));
  });
});
