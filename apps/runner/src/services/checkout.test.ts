import type { ClaimedJob } from '@bemmoly/module-pipelines/shared';
import { describe, expect, it } from 'vitest';
import { checkoutCommand, cloneCredentials, withoutCredentials } from './checkout.ts';

/* A checkout token is used for the fetch and kept out of the workspace and the log. */

const TOKEN = 'checkout-token-for-tests-0123456789';
const job = (cloneUrl: string) =>
  ({ repository: { cloneUrl, commitSha: 'a1c9e3f0' } }) as unknown as ClaimedJob;

describe('checking out with a read token', () => {
  const url = `https://x-access-token:${TOKEN}@github.com/nila/shop.git`;

  it('fetches with the token but leaves origin without it', () => {
    const command = checkoutCommand(job(url));
    expect(command).toContain("git remote add origin 'https://github.com/nila/shop.git'");
    expect(command).toContain(`git fetch --depth 1 --no-tags '${url}' 'a1c9e3f0'`);
  });

  it('masks the token in the log', () => {
    expect(cloneCredentials(url)).toContain(TOKEN);
    expect(withoutCredentials(url)).toBe('https://github.com/nila/shop.git');
  });

  it('leaves a plain URL as it is', () => {
    expect(withoutCredentials('https://github.com/nila/shop.git')).toBe(
      'https://github.com/nila/shop.git',
    );
  });
});
