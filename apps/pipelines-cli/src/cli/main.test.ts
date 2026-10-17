import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { testContext } from '../testing/context.ts';
import { fakeServer } from '../testing/fake-server.ts';
import { main } from './main.ts';

const SERVER = 'https://bemmoly.acme.test';
const ID = '0190a1b2-0000-7000-8000-000000000001';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const me = {
  body: {
    user: { id: ID, name: 'Priya Sharma', email: 'priya@acme.test' },
    modules: ['work', 'pipelines'],
  },
};

const release = {
  id: ID,
  application: { id: ID, key: 'checkout-api', name: 'Checkout API', tier: 0 },
  version: 'v1.43.0',
  source: 'external',
  run: null,
  commitSha: 'a1c9e3f',
  ref: 'main',
  imageRepository: null,
  imageDigests: { 'linux/amd64': DIGEST },
  resolvedConfig: {},
  testSummary: { total: 2, passed: 1, failed: 1, skipped: 0 },
  provenance: null,
  hasSbom: false,
  notes: null,
  createdBy: null,
  createdAt: '2026-10-17T10:00:00.000Z',
  environments: [],
};

describe('bp', () => {
  it('signs in with a device code and keeps the token readable only by its owner', async () => {
    const server = fakeServer({
      'GET /.well-known/oauth-authorization-server': [
        {
          body: {
            token_endpoint: `${SERVER}/oauth/token`,
            device_authorization_endpoint: `${SERVER}/oauth/device_authorization`,
          },
        },
      ],
      'POST /oauth/device_authorization': [
        {
          body: {
            device_code: 'dev-123',
            user_code: 'WDJB-MJHT',
            verification_uri: `${SERVER}/device`,
            expires_in: 600,
            interval: 5,
          },
        },
      ],
      'POST /oauth/token': [
        { status: 400, body: { error: 'authorization_pending' } },
        { status: 400, body: { error: 'slow_down' } },
        {
          body: { access_token: 'bmo_pat_device_token', token_type: 'Bearer', expires_in: 7776000 },
        },
      ],
      'GET /api/v1/me': [me],
    });
    const { ctx, output } = await testContext(server.fetch);
    expect(await main(ctx, ['login', '--server', SERVER])).toBe(0);
    expect(output.stdout[0]).toBe(`Open ${SERVER}/device and enter WDJB-MJHT`);
    expect(output.stdout).toContain(`Signed in to ${SERVER} as Priya Sharma (priya@acme.test).`);
    const polls = server.requests.filter((r) => r.path === '/oauth/token');
    expect(polls).toHaveLength(3);
    expect(polls[0]?.body).toEqual({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: 'dev-123',
      client_id: 'bemmoly-pipelines-cli',
    });
    expect(
      server.requests.find((r) => r.path === '/oauth/device_authorization')?.body,
    ).toMatchObject({ device_name: 'bp on build-box' });
    const file = join(ctx.env.configDir, 'credentials.json');
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(server.requests.at(-1)?.headers.authorization).toBe('Bearer bmo_pat_device_token');
  });

  it('says what to do when the server has no device sign-in', async () => {
    const server = fakeServer({
      'GET /.well-known/oauth-authorization-server': [
        { body: { token_endpoint: `${SERVER}/oauth/token` } },
      ],
    });
    const { ctx, output } = await testContext(server.fetch);
    expect(await main(ctx, ['login', '--server', SERVER])).toBe(1);
    expect(output.stderr[0]).toContain('bp login --token');
  });

  it('refuses a device sign-in that was turned down', async () => {
    const server = fakeServer({
      'GET /.well-known/oauth-authorization-server': [
        {
          body: {
            token_endpoint: `${SERVER}/oauth/token`,
            device_authorization_endpoint: `${SERVER}/oauth/device_authorization`,
          },
        },
      ],
      'POST /oauth/device_authorization': [
        {
          body: {
            device_code: 'd',
            user_code: 'U',
            verification_uri: `${SERVER}/device`,
            expires_in: 600,
            interval: 5,
          },
        },
      ],
      'POST /oauth/token': [{ status: 400, body: { error: 'access_denied' } }],
    });
    const { ctx, output } = await testContext(server.fetch);
    expect(await main(ctx, ['login', '--server', SERVER])).toBe(1);
    expect(output.stderr[0]).toBe('The sign-in was refused in the browser.');
  });

  it('registers a release with JUnit results and a CI token from the environment', async () => {
    const server = fakeServer({
      'POST /api/v1/pipelines/releases': [{ status: 201, body: release }],
    });
    const junit =
      '<testsuite><testcase classname="a.test.ts" name="ok"/><testcase classname="b.test.ts" name="bad"><failure message="boom"/></testcase></testsuite>';
    const { ctx, output } = await testContext(
      server.fetch,
      { BEMMOLY_PIPELINES_URL: SERVER, BEMMOLY_PIPELINES_TOKEN: 'bmo_ci_scoped_token' },
      { 'reports/junit.xml': junit },
    );
    const code = await main(ctx, [
      'release',
      'create',
      '--application',
      'checkout-api',
      '--commit',
      'A1C9E3F00',
      '--image',
      DIGEST,
      '--junit',
      'reports/junit.xml',
    ]);
    expect(code).toBe(0);
    const [request] = server.requests;
    expect(request?.headers.authorization).toBe('Bearer bmo_ci_scoped_token');
    expect(request?.body).toEqual({
      application: 'checkout-api',
      version: 'A1C9E3F',
      commitSha: 'a1c9e3f00',
      image: DIGEST,
      tests: {
        total: 2,
        passed: 1,
        failed: 1,
        skipped: 0,
        failures: [{ file: 'b.test.ts', name: 'bad', message: 'boom' }],
      },
    });
    expect(output.stdout[1]).toBe('Tests: 1 passed, 1 failed, 0 skipped of 2.');
  });

  it('checks a release body before sending it', async () => {
    const server = fakeServer({});
    const { ctx, output } = await testContext(server.fetch, {
      BEMMOLY_PIPELINES_URL: SERVER,
      BEMMOLY_PIPELINES_TOKEN: 'bmo_ci_scoped_token',
    });
    const code = await main(ctx, [
      'release',
      'create',
      'checkout-api',
      '--commit',
      'a1c9e3f',
      '--image',
      'latest',
    ]);
    expect(code).toBe(2);
    expect(output.stderr[0]).toBe('image: Digests look like sha256:…');
    expect(server.requests).toHaveLength(0);
  });

  it('explains an access decision and exits 1 when it is a no', async () => {
    const server = fakeServer({
      'POST /api/v1/pipelines/access/checks': [
        {
          body: {
            allowed: false,
            sentence: 'Needs a Maintainer.',
            trace: [],
            askWho: null,
            decisionId: null,
          },
        },
      ],
    });
    const { ctx, output } = await testContext(server.fetch, {
      BEMMOLY_PIPELINES_URL: SERVER,
      BEMMOLY_PIPELINES_TOKEN: 'bmo_pat_token',
    });
    expect(await main(ctx, ['why', 'request-prod', 'checkout-api', '--env', 'prod'])).toBe(1);
    expect(server.requests[0]?.body).toEqual({
      action: 'request_prod',
      application: 'checkout-api',
      environment: 'prod',
    });
    expect(output.stdout.slice(0, 2)).toEqual(['Not allowed', 'Needs a Maintainer.']);
  });

  it('never sends a stored token to another server', async () => {
    const login = fakeServer({ 'GET /api/v1/me': [me] });
    const { ctx } = await testContext(login.fetch);
    await main(ctx, ['login', '--server', SERVER, '--token', 'bmo_pat_stored']);
    const other = fakeServer({});
    const code = await main({ ...ctx, fetch: other.fetch }, [
      'whoami',
      '--server',
      'https://evil.test',
    ]);
    expect(code).toBe(2);
    expect(other.requests).toHaveLength(0);
  });

  it('answers usage mistakes with exit code 2', async () => {
    const { ctx, output } = await testContext(fakeServer({}).fetch);
    expect(await main(ctx, ['run'])).toBe(2);
    expect(await main(ctx, ['frobnicate'])).toBe(2);
    expect(await main(ctx, ['run', 'x', '--bogus'])).toBe(2);
    expect(output.stderr.at(-1)).toMatch(/bogus/);
  });
});
