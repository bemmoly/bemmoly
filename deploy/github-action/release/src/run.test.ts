import { describe, expect, it } from 'vitest';
import { parseActionEnv } from './config/env.ts';
import { OIDC_MISSING, runAction, type ActionIo } from './run.ts';

const DIGEST = `sha256:${'b'.repeat(64)}`;
const ID = '0190a1b2-0000-7000-8000-000000000001';

const ENV = {
  INPUT_SERVER: 'https://bemmoly.acme.test/',
  INPUT_APPLICATION: 'checkout-api',
  INPUT_IMAGE: DIGEST,
  INPUT_IMAGES: '',
  'INPUT_IMAGE-REPOSITORY': 'ghcr.io/acme/checkout-api',
  INPUT_VERSION: '',
  INPUT_TESTS: 'reports/*.xml\n',
  INPUT_NOTES: '',
  INPUT_TOKEN: '',
  GITHUB_SHA: 'a1c9e3f0a1c9e3f0a1c9e3f0a1c9e3f0a1c9e3f0',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: 'acme/checkout',
  GITHUB_RUN_ID: '42',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.test/request?api-version=2.0',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'runtime-token',
};

const release = {
  id: ID,
  application: { id: ID, key: 'checkout-api', name: 'Checkout API', tier: 0 },
  version: 'a1c9e3f',
  source: 'external',
  run: null,
  commitSha: 'a1c9e3f',
  ref: 'refs/heads/main',
  imageRepository: 'ghcr.io/acme/checkout-api',
  imageDigests: { 'linux/amd64': DIGEST },
  resolvedConfig: {},
  testSummary: { total: 1, passed: 1, failed: 0, skipped: 0 },
  provenance: null,
  hasSbom: false,
  notes: null,
  createdBy: null,
  createdAt: '2026-10-17T10:00:00.000Z',
  environments: [],
};

function harness() {
  const calls: Array<{ url: string; headers: Record<string, string>; body: unknown }> = [];
  const outputs: Record<string, string> = {};
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({ url, headers, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (new URL(url).host === 'token.actions.test') {
      return Response.json({ value: 'eyJhbGciOiJSUzI1NiJ9.workflow-oidc-token' });
    }
    return Response.json(release, { status: 201 });
  };
  const io: ActionIo = {
    fetch,
    findReports: async (patterns) => (patterns.length > 0 ? ['/w/reports/unit.xml'] : []),
    readFile: async () => '<testsuite><testcase classname="a.test.ts" name="ok"/></testsuite>',
    info: () => undefined,
    setOutput: async (name, value) => {
      outputs[name] = value;
    },
    summary: async () => undefined,
  };
  return { calls, outputs, io };
}

describe('bemmoly/release', () => {
  it('signs with the workflow OIDC token for the server as audience', async () => {
    const { calls, outputs, io } = harness();
    await runAction(parseActionEnv(ENV), io);
    const [oidc, register] = calls;
    expect(new URL(oidc?.url ?? '').searchParams.get('audience')).toBe('https://bemmoly.acme.test');
    expect(oidc?.headers.authorization).toBe('Bearer runtime-token');
    expect(register?.url).toBe('https://bemmoly.acme.test/api/v1/pipelines/releases');
    expect(register?.headers.authorization).toBe('Bearer eyJhbGciOiJSUzI1NiJ9.workflow-oidc-token');
    expect(register?.body).toEqual({
      application: 'checkout-api',
      version: 'a1c9e3f',
      commitSha: ENV.GITHUB_SHA,
      ref: 'refs/heads/main',
      imageRepository: 'ghcr.io/acme/checkout-api',
      image: DIGEST,
      tests: { total: 1, passed: 1, failed: 0, skipped: 0, failures: [] },
      externalUrl: 'https://github.com/acme/checkout/actions/runs/42',
    });
    expect(outputs).toEqual({ 'release-id': ID, version: 'a1c9e3f' });
  });

  it('uses a CI token when one is given, and never asks GitHub', async () => {
    const { calls, io } = harness();
    await runAction(
      parseActionEnv({ ...ENV, INPUT_TOKEN: 'bmo_ci_token_123', INPUT_TESTS: '' }),
      io,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.authorization).toBe('Bearer bmo_ci_token_123');
  });

  it('reads one platform=digest per line', async () => {
    const { calls, io } = harness();
    const images = `linux/amd64=${DIGEST}\nlinux/arm64=${DIGEST}\n`;
    await runAction(parseActionEnv({ ...ENV, INPUT_IMAGE: '', INPUT_IMAGES: images }), io);
    expect(calls[1]?.body).toMatchObject({
      images: { 'linux/amd64': DIGEST, 'linux/arm64': DIGEST },
    });
  });

  it('says how to give it a token when id-token write is missing', async () => {
    const { io } = harness();
    const env = parseActionEnv({
      ...ENV,
      ACTIONS_ID_TOKEN_REQUEST_URL: '',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: '',
    });
    await expect(runAction(env, io)).rejects.toThrow(OIDC_MISSING);
  });

  it('refuses inputs it cannot use before calling anyone', async () => {
    expect(() => parseActionEnv({ ...ENV, INPUT_SERVER: 'bemmoly' })).toThrow(/server must be/);
    const { calls, io } = harness();
    await expect(runAction(parseActionEnv({ ...ENV, INPUT_IMAGE: 'latest' }), io)).rejects.toThrow(
      /Digests look like/,
    );
    expect(calls).toHaveLength(0);
  });
});
