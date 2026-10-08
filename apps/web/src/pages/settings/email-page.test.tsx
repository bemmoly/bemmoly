import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { EmailPage } from './email-page.tsx';

describe('EmailPage', () => {
  it('points the log provider at the dev mailbox and shows the outbox failures', async () => {
    const { queryClient } = await renderPage(() => <EmailPage />, '/settings/email');
    const link = await screen.findByRole('link', { name: 'Open the dev mailbox' });
    expect(link.getAttribute('href')).toBe('/dev/mailbox');
    expect(await screen.findByText(/^3 emails failed since \w+: 535 5\.7\.8/)).toBeDefined();
    expect(screen.getByRole('table', { name: 'Recent failed emails' })).toBeDefined();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Send test email' })));
    expect(await screen.findByText(/^Sent to rohan@acmelabs\.dev through the log/)).toBeDefined();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('shows SMTP fields with the stored password as Set', async () => {
    mockApi.db.settings['email.provider'] = 'smtp';
    mockApi.db.settings['email.smtp.password'] = 'stored-secret';
    await renderPage(() => <EmailPage />, '/settings/email');
    const delivery = await screen.findByRole('region', { name: 'Delivery' });
    expect(within(delivery).getByText('Set')).toBeDefined();
    expect(within(delivery).queryByRole('textbox')).toBeNull();
    act(() => fireEvent.click(within(delivery).getByRole('button', { name: 'Edit Delivery' })));
    expect(screen.getByLabelText('Server')).toBeDefined();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Replace' })));
    expect(screen.getByLabelText(/Password/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open the dev mailbox' })).toBeNull();
  });
});
