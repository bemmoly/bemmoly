import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRestClient } from '../../../clients/rest.ts';
import { githubWrites } from './github-writes.ts';

/*
 * The writes against recorded GitHub API answers (testing/code-hosts/github-api), served by
 * an in-memory fetch keyed on method and path. Nothing reaches the network.
 */

const answer = (name: string) =>
  readFileSync(
    new URL(`../../../testing/code-hosts/github-api/${name}.json`, import.meta.url),
    'utf8',
  );

type Route = { status: number; body: string };

function fakeGithub(routes: Record<string, Route>) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';
    const key = `${method} ${url.pathname}`;
    calls.push({
      method,
      path: `${url.pathname}${url.search}`,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const route = routes[key] ?? { status: 404, body: '{"message":"Not Found"}' };
    return new Response(route.body, {
      status: route.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  const rest = createRestClient({ baseUrl: 'https://api.github.com', fetch, maxRetries: 0 });
  return { calls, writes: githubWrites(async () => rest) };
}

describe('GitHub writes', () => {
  it('creates a check run, then updates the same one', async () => {
    const { calls, writes } = fakeGithub({
      'POST /repos/acme/api/check-runs': { status: 201, body: answer('check-run.created') },
      'PATCH /repos/acme/api/check-runs/28809990001': {
        status: 200,
        body: answer('check-run.created'),
      },
    });
    const created = await writes.reportCheck({
      repository: 'acme/api',
      headSha: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
      name: 'Bemmoly · checkout-api',
      status: 'in_progress',
      detailsUrl: 'https://bemmoly.acme.dev/pipelines/runs/812',
    });
    expect(created).toEqual({ externalId: '28809990001' });
    await writes.reportCheck({
      repository: 'acme/api',
      headSha: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
      name: 'Bemmoly · checkout-api',
      externalId: created.externalId,
      status: 'completed',
      conclusion: 'failure',
      title: 'Unit 2 of 4 failed',
    });
    expect(calls[0]?.body).toMatchObject({ name: 'Bemmoly · checkout-api', status: 'in_progress' });
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      body: { status: 'completed', conclusion: 'failure', output: { title: 'Unit 2 of 4 failed' } },
    });
  });

  it('creates a deployment with no required contexts and posts its status', async () => {
    const { calls, writes } = fakeGithub({
      'POST /repos/acme/api/deployments': { status: 201, body: answer('deployment.created') },
      'POST /repos/acme/api/deployments/1789001234/statuses': {
        status: 201,
        body: answer('deployment-status.created'),
      },
    });
    const result = await writes.reportDeployment({
      repository: 'acme/api',
      ref: 'e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8',
      environment: 'prod-asia-south1',
      state: 'in_progress',
      production: true,
    });
    expect(result).toEqual({ externalId: '1789001234' });
    expect(calls[0]?.body).toMatchObject({ required_contexts: [], production_environment: true });
    expect(calls[1]?.body).toEqual({ state: 'in_progress' });
  });

  it('reads a file, and answers null for one that does not exist', async () => {
    const { writes } = fakeGithub({
      'GET /repos/acme/api/contents/services/checkout-api/.bemmoly/application.yaml': {
        status: 200,
        body: answer('contents.application'),
      },
    });
    const file = await writes.readFile(
      'acme/api',
      'services/checkout-api/.bemmoly/application.yaml',
      'main',
    );
    expect(file).toContain('owner: team/payments');
    expect(await writes.readFile('acme/api', 'missing.yaml', 'main')).toBeNull();
  });

  it('lists blobs only from the tree', async () => {
    const { writes } = fakeGithub({
      'GET /repos/acme/api/git/trees/main': { status: 200, body: answer('tree.main') },
    });
    expect(await writes.listFiles('acme/api', 'main')).toEqual({
      paths: [
        'services/checkout-api/Dockerfile',
        'services/checkout-api/.bemmoly/application.yaml',
        'pnpm-workspace.yaml',
      ],
      truncated: false,
    });
  });

  it('opens a pull request on a branch it creates, reusing an existing branch', async () => {
    const { calls, writes } = fakeGithub({
      'GET /repos/acme/api/git/ref/heads/main': { status: 200, body: answer('ref.main') },
      'POST /repos/acme/api/git/refs': {
        status: 422,
        body: '{"message":"Reference already exists"}',
      },
      'PUT /repos/acme/api/contents/services/checkout-api/.bemmoly/application.yaml': {
        status: 201,
        body: '{}',
      },
      'POST /repos/acme/api/pulls': { status: 201, body: answer('pull.created') },
    });
    const pull = await writes.openPullRequest({
      repository: 'acme/api',
      baseBranch: 'main',
      branch: 'bemmoly/catalog-checkout-api',
      title: 'Add checkout-api to the Bemmoly catalog',
      body: 'Proposed by discovery.',
      files: [
        {
          path: 'services/checkout-api/.bemmoly/application.yaml',
          content: 'name: checkout-api\n',
        },
      ],
    });
    expect(pull).toEqual({ url: 'https://github.com/acme/api/pull/4830', number: 4830 });
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.body).toMatchObject({
      branch: 'bemmoly/catalog-checkout-api',
      content: Buffer.from('name: checkout-api\n').toString('base64'),
    });
    expect(put?.body).not.toHaveProperty('sha');
  });
});
