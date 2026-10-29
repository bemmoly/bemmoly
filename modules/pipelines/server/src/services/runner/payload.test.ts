import type { CodeHostClient } from '@bemmoly/core';
import { describe, expect, it } from 'vitest';
import type { PipelinesCodeHosts } from '../code/hosts.ts';
import { withReadToken } from './payload.ts';

/* A checkout gets a read-only token for its repository, except where it must not. */

const URL_PLAIN = 'https://github.com/nila/shop.git';

function hosts(token: string | null): PipelinesCodeHosts & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async client() {
      return {
        async readToken(repository: string) {
          asked.push(repository);
          return token ? { username: 'x-access-token', token, expiresAt: null } : null;
        },
      } as unknown as CodeHostClient;
    },
    async repositories() {
      return [];
    },
  };
}

describe('the clone URL a runner gets', () => {
  it('carries a token that reads only this repository', async () => {
    const code = hosts('read-only-checkout');
    const url = await withReadToken(URL_PLAIN, { full_name: 'nila/shop', from_fork: false }, code);
    expect(url).toBe('https://x-access-token:read-only-checkout@github.com/nila/shop.git');
    expect(code.asked).toEqual(['nila/shop']);
  });

  it('gives a fork none, as it gives a fork no secrets', async () => {
    const code = hosts('read-only-checkout');
    expect(await withReadToken(URL_PLAIN, { full_name: 'nila/shop', from_fork: true }, code)).toBe(
      URL_PLAIN,
    );
    expect(code.asked).toEqual([]);
  });

  it('stays plain when the host cannot mint one or there is no host', async () => {
    const row = { full_name: 'nila/shop', from_fork: false };
    expect(await withReadToken(URL_PLAIN, row, hosts(null))).toBe(URL_PLAIN);
    expect(await withReadToken(URL_PLAIN, row, undefined)).toBe(URL_PLAIN);
  });
});
