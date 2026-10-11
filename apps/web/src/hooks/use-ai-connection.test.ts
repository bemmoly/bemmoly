import { describe, expect, it } from 'vitest';
import { LOCAL_SERVER, type CatalogProvider } from './use-ai-catalog.ts';
import {
  connectionFields,
  createBody,
  draftErrors,
  initialDraft,
  testLine,
} from './use-ai-connection.ts';

const PROVIDER: CatalogProvider = {
  id: 'acme-cloud',
  name: 'Acme Cloud',
  env: ['ACME_API_KEY', 'ACME_REGION', 'ACME_SECRET_ACCESS_KEY'],
  api: 'https://api.acme.example/v1',
  doc: 'https://acme.example/docs',
  npm: '@ai-sdk/openai-compatible',
};

describe('the generated connection form', () => {
  it('asks for every name in the catalog entry, masking keys and secrets only', () => {
    expect(connectionFields(PROVIDER)).toEqual([
      { name: 'ACME_API_KEY', secret: true },
      { name: 'ACME_REGION', secret: false },
      { name: 'ACME_SECRET_ACCESS_KEY', secret: true },
    ]);
  });

  it('pre-fills the base URL and sends it only when changed', () => {
    const draft = initialDraft(PROVIDER);
    expect(draft.baseUrl).toBe(PROVIDER.api);
    const body = createBody(PROVIDER, {
      ...draft,
      values: { ACME_API_KEY: ' k1 ', ACME_REGION: '' },
    });
    expect(body).toEqual({
      kind: 'catalog',
      catalogId: 'acme-cloud',
      credentials: { ACME_API_KEY: 'k1' },
      headers: {},
    });
    const proxied = createBody(PROVIDER, { ...draft, baseUrl: 'https://proxy.internal/v1' });
    expect(proxied).toMatchObject({ baseUrl: 'https://proxy.internal/v1' });
  });

  it('builds a Local server with its protocol, address and optional key', () => {
    const draft = { ...initialDraft(LOCAL_SERVER), baseUrl: 'http://10.0.0.5:8000/v1' };
    expect(createBody(LOCAL_SERVER, draft)).toEqual({
      kind: 'custom',
      protocol: 'openai-compatible',
      name: 'Local server',
      baseUrl: 'http://10.0.0.5:8000/v1',
      headers: {},
    });
    expect(createBody(LOCAL_SERVER, { ...draft, apiKey: 'secret' })).toMatchObject({
      apiKey: 'secret',
    });
  });

  it('says under the field what a Local server address needs', () => {
    expect(draftErrors(LOCAL_SERVER, initialDraft(LOCAL_SERVER)).baseUrl).toMatch(
      /Enter the address/,
    );
    expect(
      draftErrors(LOCAL_SERVER, { ...initialDraft(LOCAL_SERVER), baseUrl: '10.0.0.5' }).baseUrl,
    ).toMatch(/http:\/\//);
    expect(draftErrors(PROVIDER, initialDraft(PROVIDER))).toEqual({});
  });

  it('reports a test in plain words, with the models a server lists', () => {
    const base = { latencyMs: 9, model: null, checkedAt: new Date().toISOString() };
    expect(testLine({ ...base, ok: true, message: 'Connected', modelsFound: 3 })).toBe(
      'Connected · 3 models found',
    );
    expect(testLine({ ...base, ok: false, message: 'Refused the key', modelsFound: null })).toBe(
      'Refused the key',
    );
  });
});
