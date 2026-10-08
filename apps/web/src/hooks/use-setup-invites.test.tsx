import type { Role } from '@bemmoly/shared';
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetupStore } from '../store/setup.ts';
import { renderQueryHook } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import {
  defaultRoleId,
  invitationsSentMessage,
  parseEmails,
  useSetupInvites,
} from './use-setup-invites.ts';

beforeEach(() => useSetupStore.getState().reset());

describe('parseEmails', () => {
  it('splits on commas, semicolons, spaces and newlines, de-duplicating', () => {
    expect(parseEmails('A@x.dev, b@x.dev\nc@x.dev;  a@x.dev\n\n')).toEqual({
      valid: ['a@x.dev', 'b@x.dev', 'c@x.dev'],
      invalid: [],
    });
  });

  it('keeps what is not an address apart', () => {
    expect(parseEmails('priya@x.dev, nope, @x')).toEqual({
      valid: ['priya@x.dev'],
      invalid: ['nope', '@x'],
    });
  });
});

describe('invite helpers', () => {
  const role = (id: string, key: string) => ({ id, key, name: key }) as Role;

  it('defaults to the least-privileged Viewer, else the first non-admin role', () => {
    const roles = [role('1', 'org_admin'), role('2', 'member'), role('3', 'viewer')];
    expect(defaultRoleId(roles)).toBe('3');
    expect(defaultRoleId([role('1', 'org_admin'), role('2', 'member')])).toBe('2');
    expect(defaultRoleId([])).toBeNull();
  });

  it('counts in words', () => {
    expect(invitationsSentMessage(1)).toBe('1 invitation sent');
    expect(invitationsSentMessage(3)).toBe('3 invitations sent');
  });
});

describe('useSetupInvites', () => {
  it('turns typed addresses into chips and holds back the rest', async () => {
    const { result } = await renderQueryHook(() => useSetupInvites(vi.fn()));
    act(() => result.current.change('new.one@acme.test, nope,'));
    expect(result.current.emails).toEqual(['new.one@acme.test']);
    expect(result.current.text).toBe('nope');
    expect(result.current.error).toBe('Not an email address: nope');
    act(() => result.current.remove('new.one@acme.test'));
    expect(result.current.emails).toEqual([]);
  });

  it('sends chips and the unfinished address with the Viewer role, then shows the links to share', async () => {
    const onDone = vi.fn();
    const { result } = await renderQueryHook(() => useSetupInvites(onDone));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const viewer = mockApi.db.roles.find((entry) => entry.key === 'viewer');
    expect(result.current.roleId).toBe(viewer?.id);
    const before = mockApi.db.invitations.length;
    act(() => result.current.paste('first@acme.test\nsecond@acme.test'));
    act(() => result.current.change('third@acme.test'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.issued?.items).toHaveLength(3));
    expect(mockApi.db.invitations.length - before).toBe(3);
    expect(useSetupStore.getState().invitesSent).toBe(3);
    expect(useSetupStore.getState().emails).toEqual([]);
    // Email is not set up in the mock workspace, so the step waits for Continue.
    expect(result.current.issued?.emailConfigured).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    act(() => result.current.finish());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('moves on by itself when email delivery is set up', async () => {
    mockApi.db.settings['email.provider'] = 'smtp';
    mockApi.db.settings['email.smtp.host'] = 'smtp.acme.test';
    const onDone = vi.fn();
    const { result } = await renderQueryHook(() => useSetupInvites(onDone));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.paste('first@acme.test'));
    act(() => result.current.submit());
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(result.current.issued?.emailConfigured).toBe(true);
  });

  it('continues without a request when there is nobody to invite', async () => {
    const onDone = vi.fn();
    const before = mockApi.db.invitations.length;
    const { result } = await renderQueryHook(() => useSetupInvites(onDone));
    act(() => result.current.submit());
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockApi.db.invitations.length).toBe(before);
  });

  it('does not send while an address is invalid', async () => {
    const onDone = vi.fn();
    const { result } = await renderQueryHook(() => useSetupInvites(onDone));
    act(() => result.current.change('ok@acme.test'));
    act(() => result.current.change('ok@acme.test bad'));
    act(() => result.current.submit());
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.mutation.isIdle).toBe(true);
    expect(result.current.error).toContain('bad');
  });
});
