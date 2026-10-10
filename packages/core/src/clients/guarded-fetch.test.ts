import { describe, expect, it, vi } from 'vitest';
import { addressPolicyOf } from '../services/ai/runtime/loader.ts';
import { createGuardedFetch, RedirectRefusedError } from './guarded-fetch.ts';
import { PrivateAddressError } from './network.ts';

function fakeFetch(status = 200) {
  return vi.fn(async (_input: unknown, _init?: RequestInit) => new Response('{}', { status }));
}

describe('the fetch model providers call through', () => {
  it('keeps a catalog provider off private and link-local addresses', async () => {
    const base = fakeFetch();
    const guarded = createGuardedFetch('public', base as unknown as typeof fetch);
    for (const url of [
      'http://127.0.0.1:11434/v1/chat/completions',
      'http://10.0.0.5/v1/chat/completions',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::ffff:127.0.0.1]/v1/models',
    ]) {
      await expect(guarded(url)).rejects.toBeInstanceOf(PrivateAddressError);
    }
    expect(base).not.toHaveBeenCalled();
  });

  it('lets a Local server reach its own network, but never cloud metadata', async () => {
    const base = fakeFetch();
    const guarded = createGuardedFetch('local', base as unknown as typeof fetch);
    await guarded('http://127.0.0.1:11434/v1/chat/completions', { method: 'POST' });
    await guarded('http://192.168.1.20:8000/v1/models');
    expect(base).toHaveBeenCalledTimes(2);
    await expect(guarded('http://169.254.169.254/v1/models')).rejects.toBeInstanceOf(
      PrivateAddressError,
    );
    await expect(guarded('http://[fe80::1]/v1/models')).rejects.toBeInstanceOf(PrivateAddressError);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('refuses redirects instead of following them, whatever the policy', async () => {
    const base = fakeFetch(302);
    const guarded = createGuardedFetch('any', base as unknown as typeof fetch);
    await expect(guarded('http://169.254.169.254/v1/models')).rejects.toBeInstanceOf(
      RedirectRefusedError,
    );
    expect(base.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('reads the policy from the provider kind and BEMMOLY_ALLOW_PRIVATE_URLS', () => {
    expect(addressPolicyOf({ catalogId: 'openai' }, false)).toBe('public');
    expect(addressPolicyOf({ catalogId: 'custom' }, false)).toBe('local');
    expect(addressPolicyOf({ catalogId: 'openai' }, true)).toBe('any');
  });
});
