import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { HostConnection } from '../types.ts';
import { githubHost } from './github.ts';

/*
 * The repositories a GitHub App's installation covers, read page by page from an in-memory
 * GitHub. Nothing reaches the network.
 */

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const connection = (authMode: 'app' | 'token'): HostConnection => ({
  baseUrl: null,
  authMode,
  appId: '1001',
  installationId: '2002',
  secrets: {
    webhookSecret: 'whsec',
    token: 'test-token',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  },
});

const repository = (n: number, archived = false) => ({
  full_name: `acme/repo-${n}`,
  default_branch: n % 2 === 0 ? 'main' : 'master',
  html_url: `https://github.com/acme/repo-${n}`,
  archived,
});

function fakeGithub(total: number, archived: ReadonlySet<number> = new Set()) {
  const pages: string[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (init?.method === 'POST' && url.pathname === '/app/installations/2002/access_tokens') {
      return json({ token: 'installation-token' }, 201);
    }
    if (url.pathname === '/installation/repositories') {
      const page = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('per_page'));
      pages.push(`${page}`);
      const numbers = Array.from({ length: total }, (_, i) => i + 1).slice(
        (page - 1) * size,
        page * size,
      );
      return json({
        total_count: total,
        repositories: numbers.map((n) => repository(n, archived.has(n))),
      });
    }
    return json({ message: 'Not Found' }, 404);
  };
  return { fetch, pages };
}

describe('a GitHub App installation’s repositories', () => {
  it('reads every page, with each default branch, and leaves archived ones out', async () => {
    const github = fakeGithub(230, new Set([7]));
    const api = githubHost.api(connection('app'), { policy: 'any', fetch: github.fetch });
    const found = (await api.listRepositories?.()) ?? [];
    expect(github.pages).toEqual(['1', '2', '3']);
    expect(found).toHaveLength(229);
    expect(found[0]).toEqual({
      fullName: 'acme/repo-1',
      defaultBranch: 'master',
      url: 'https://github.com/acme/repo-1',
    });
    expect(found.some((repo) => repo.fullName === 'acme/repo-7')).toBe(false);
  });

  it('stops after one page when the installation fits on it', async () => {
    const github = fakeGithub(3);
    const api = githubHost.api(connection('app'), { policy: 'any', fetch: github.fetch });
    expect(await api.listRepositories?.()).toHaveLength(3);
    expect(github.pages).toEqual(['1']);
  });

  it('is not offered on a token, which sees more than Bemmoly was given', () => {
    const api = githubHost.api(connection('token'), { policy: 'any' });
    expect(api.listRepositories).toBeUndefined();
  });
});
