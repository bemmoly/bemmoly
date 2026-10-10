import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import allowList from './allow-list.json' with { type: 'json' };
import credentialOptions from './credential-options.json' with { type: 'json' };
import { factoryOptions, loaderKindOf, loadProvider, type ProviderConnection } from './loader.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'),
) as { dependencies: Record<string, string> };
const require = createRequire(new URL('../../../../package.json', import.meta.url));

/** The package part of an allow-list entry: "@scope/name/sub" → "@scope/name". */
const packageOf = (entry: string) =>
  entry
    .split('/')
    .slice(0, entry.startsWith('@') ? 2 : 1)
    .join('/');

const connection = (change: Partial<ProviderConnection> = {}): ProviderConnection => ({
  catalogId: 'acme',
  npm: null,
  protocol: null,
  name: 'Acme AI',
  baseUrl: 'https://llm.acme.test/v1',
  credentials: { ACME_API_KEY: 'k-1' },
  headers: {},
  ...change,
});

describe('the bundled allow-list', () => {
  it('names only packages core declares, and each resolves', () => {
    for (const entry of allowList) {
      expect(manifest.dependencies[packageOf(entry)], entry).toBeDefined();
      expect(() => require.resolve(entry), entry).not.toThrow();
    }
  });

  it('holds the protocol packages the Local server path needs', () => {
    for (const name of Object.values(credentialOptions.protocols)) {
      expect(allowList).toContain(name);
    }
    expect(allowList).toContain(credentialOptions.compatible);
  });
});

describe('loader resolution', () => {
  it('uses the catalog package when it is allowed, the compatible client otherwise', () => {
    expect(loaderKindOf(allowList.find((name) => name !== credentialOptions.compatible))).toBe(
      'package',
    );
    expect(loaderKindOf('third-party-provider')).toBe('compatible');
    expect(loaderKindOf('')).toBe('compatible');
    expect(loaderKindOf(null)).toBe('compatible');
    expect(loaderKindOf(credentialOptions.compatible)).toBe('compatible');
  });

  it('maps credentials to factory options by env-name suffix', () => {
    const options = factoryOptions(
      connection({
        credentials: {
          ACME_API_KEY: 'k-1',
          ACME_RESOURCE_NAME: 'eu-1',
          CLOUD_ACCESS_KEY_ID: 'id',
          CLOUD_SECRET_ACCESS_KEY: 'secret',
          CLOUD_REGION: 'eu-west-1',
          SOMETHING_UNKNOWN: 'ignored',
        },
        headers: { 'X-Team': 'core' },
      }),
    );
    expect(options).toEqual({
      apiKey: 'k-1',
      resourceName: 'eu-1',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      region: 'eu-west-1',
      baseURL: 'https://llm.acme.test/v1',
      headers: { 'X-Team': 'core' },
      name: 'acme',
    });
  });

  it('parses JSON credentials into nested options and refuses bad JSON', () => {
    const options = factoryOptions(
      connection({ credentials: { CLOUD_APPLICATION_CREDENTIALS: '{"client_email":"a@b.test"}' } }),
    );
    expect(options['googleAuthOptions']).toEqual({ credentials: { client_email: 'a@b.test' } });
    expect(() =>
      factoryOptions(connection({ credentials: { CLOUD_APPLICATION_CREDENTIALS: 'nope' } })),
    ).toThrow(/JSON/);
  });

  it('builds a compatible provider without any network call', async () => {
    const provider = await loadProvider(connection({ npm: 'not-on-the-list' }));
    expect(provider.loader).toBe('compatible');
    const model = provider.languageModel('acme-large');
    expect(model.modelId).toBe('acme-large');
  });

  it('loads a Local server through its protocol package', async () => {
    const provider = await loadProvider(
      connection({ catalogId: 'custom', protocol: 'anthropic-compatible' }),
    );
    expect(provider.languageModel('local-model').modelId).toBe('local-model');
  });

  it('refuses a compatible provider without a base URL', async () => {
    await expect(loadProvider(connection({ baseUrl: null }))).rejects.toThrow(/base URL/);
  });
});
