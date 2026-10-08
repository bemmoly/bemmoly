import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  deliveryRisk,
  useEmailOutbox,
  useEmailSettings,
  useEmailTest,
} from './use-email-settings.ts';

const SMTP_DELIVERY = {
  provider: 'smtp' as const,
  host: 'smtp.acmelabs.dev',
  username: 'bemmoly',
};

const BASE_FORM = {
  provider: 'log' as const,
  host: 'smtp.acmelabs.dev',
  port: '587',
  security: 'starttls' as const,
  username: '',
  password: '',
  from: 'bemmoly@acmelabs.dev',
  replyTo: '',
  digestMinutes: '10',
};

describe('useEmailSettings', () => {
  it('starts on the dev mailbox with no password stored', async () => {
    const { result } = await renderQueryHook(() => useEmailSettings());
    await waitFor(() => expect(result.current.value).toBeDefined());
    expect(result.current.canManage).toBe(true);
    expect(result.current.usesDevMailbox).toBe(true);
    expect(result.current.password).toMatchObject({ isSet: false, editing: true });
    expect(result.current.value?.port).toBe('587');
  });

  it('saves Delivery without sending a blank password or touching the sender', async () => {
    mockApi.db.settings['email.smtp.password'] = 'stored-secret';
    mockApi.db.settings['email.from'] = 'bemmoly@acmelabs.dev';
    const { result } = await renderQueryHook(() => useEmailSettings());
    await waitFor(() => expect(result.current.value).toBeDefined());
    expect(result.current.password).toMatchObject({ isSet: true, editing: false });
    act(() => result.current.update(SMTP_DELIVERY));
    act(() => result.current.update({ digestMinutes: '30' }));
    expect(result.current.dirty).toEqual({ delivery: true, sender: true });
    const prepared = result.current.prepare('delivery');
    act(() => result.current.save('delivery', prepared?.writes ?? {}));
    await waitFor(() => expect(result.current.settings.save.isSuccess).toBe(true));
    expect(mockApi.db.settings['email.provider']).toBe('smtp');
    expect(mockApi.db.settings['email.smtp.host']).toBe('smtp.acmelabs.dev');
    expect(mockApi.db.settings['email.smtp.password']).toBe('stored-secret');
    expect(mockApi.db.settings['email.digestMinutes']).not.toBe(30);
    await waitFor(() => expect(result.current.dirty).toEqual({ delivery: false, sender: true }));
  });

  it('replaces the password when a new one is typed', async () => {
    mockApi.db.settings['email.smtp.password'] = 'stored-secret';
    mockApi.db.settings['email.from'] = 'bemmoly@acmelabs.dev';
    const { result } = await renderQueryHook(() => useEmailSettings());
    await waitFor(() => expect(result.current.value).toBeDefined());
    act(() => result.current.password.replace());
    expect(result.current.password.editing).toBe(true);
    act(() => result.current.update({ ...SMTP_DELIVERY, password: 'new-secret' }));
    const prepared = result.current.prepare('delivery');
    act(() => result.current.save('delivery', prepared?.writes ?? {}));
    await waitFor(() => expect(mockApi.db.settings['email.smtp.password']).toBe('new-secret'));
  });

  it('shows field errors and saves nothing when the form is invalid', async () => {
    const { result } = await renderQueryHook(() => useEmailSettings());
    await waitFor(() => expect(result.current.value).toBeDefined());
    act(() => result.current.update({ provider: 'smtp', host: '' }));
    let prepared: unknown = 'unset';
    act(() => {
      prepared = result.current.prepare('delivery');
    });
    expect(prepared).toBeNull();
    expect(result.current.errors['host']).toBeDefined();
    expect(result.current.settings.save.isIdle).toBe(true);
  });

  it('asks before switching from a relay to the dev mailbox', () => {
    const relay = { ...BASE_FORM, provider: 'smtp' as const };
    expect(deliveryRisk(relay, { ...relay, provider: 'log' })?.confirmLabel).toBe(
      'Use the dev mailbox',
    );
    expect(deliveryRisk({ ...relay, provider: 'log' }, relay)).toBeNull();
  });
});

describe('useEmailTest', () => {
  it('sends to yourself and reports the deliverability checks', async () => {
    const { result } = await renderQueryHook(() => useEmailTest());
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result?.sent).toBe(true);
    expect(result.current.result?.headline).toMatch(/^Sent to .+ through the log provider/);
    expect(result.current.result?.dns.find((check) => check.name === 'DMARC')?.toAdd).toMatch(
      /^_dmarc\./,
    );
  });

  it('reports a rejected sign-in in plain words', async () => {
    mockApi.db.settings['email.provider'] = 'smtp';
    mockApi.db.settings['email.smtp.host'] = 'smtp.fail.dev';
    const { result } = await renderQueryHook(() => useEmailTest());
    act(() => result.current.setTo('priya@acmelabs.dev'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result).toMatchObject({
      sent: false,
      headline: 'smtp.fail.dev rejected the username and password.',
      stage: 'auth',
      serverResponse: '535 5.7.8 Authentication rejected',
    });
  });

  it('checks the recipient before sending', async () => {
    const { result } = await renderQueryHook(() => useEmailTest());
    act(() => result.current.setTo('not-an-address'));
    act(() => result.current.submit());
    expect(result.current.error).toBe('Enter a valid email address');
    expect(result.current.send.isIdle).toBe(true);
  });
});

describe('useEmailOutbox', () => {
  it('summarises the failures and lists the recent ones', async () => {
    const { result } = await renderQueryHook(() => useEmailOutbox(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.status).toMatch(/^3 emails failed since \w+: 535 5\.7\.8/);
    expect(result.current.failing).toBe(true);
    expect(result.current.failures).toHaveLength(3);
    expect(result.current.counts.map((entry) => entry.label)).toEqual(['queued', 'sent', 'failed']);
  });
});
