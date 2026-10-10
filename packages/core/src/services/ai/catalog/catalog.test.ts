import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { CatalogFetch, ModelsDevClient } from '../../../clients/models-dev.ts';
import { safeSvg } from './bundled.ts';
import { eligibleRoles, suggestedDefaults } from './overrides.ts';
import { createCatalogResolver } from './resolver.ts';
import { relativeTime } from './status.ts';
import { trimCatalog } from './trim.ts';

const LIVE = {
  acme: {
    id: 'acme',
    name: 'Acme AI',
    env: ['ACME_API_KEY'],
    npm: '@acme/ai-sdk-provider',
    doc: 'https://acme.test/docs',
    description: 'dropped by the trim',
    models: {
      'acme-mini': {
        id: 'acme-mini',
        name: 'Acme Mini',
        tool_call: true,
        release_date: '2026-09-01',
        cost: { input: 0.1, output: 0.4, reasoning: 9 },
        knowledge: 'dropped',
      },
    },
  },
};

function fakeClient(script: (() => CatalogFetch | Promise<CatalogFetch>)[]) {
  const calls: (string | null)[] = [];
  const client: ModelsDevClient = {
    async fetchCatalog({ etag }) {
      calls.push(etag);
      const next = script.shift();
      if (!next) throw new Error('models.dev unreachable');
      return next();
    },
    fetchLogo: async () => null,
  };
  return { client, calls };
}

const clock = (start: string) => {
  let now = new Date(start);
  return { now: () => now, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
};

describe('catalog resolution order', () => {
  it('uses the live catalog first and says so', async () => {
    const time = clock('2026-10-10T10:00:00Z');
    const { client } = fakeClient([() => ({ status: 'fresh', etag: '"v1"', body: LIVE })]);
    const resolver = createCatalogResolver({
      client,
      liveEnabled: async () => true,
      appVersion: '0.5.0',
      now: time.now,
    });
    const resolved = await resolver.resolve();
    expect(Object.keys(resolved.data)).toEqual(['acme']);
    expect(resolved.status).toMatchObject({ source: 'live', offline: false, liveFetch: true });
    expect(resolved.status.line).toBe('Live · models.dev · updated just now');
    time.advance(4 * 60_000);
    expect((await resolver.resolve()).status.line).toBe(
      'Live · models.dev · updated 4 minutes ago',
    );
  });

  it('reuses a fresh copy for an hour, then revalidates with the ETag', async () => {
    const time = clock('2026-10-10T10:00:00Z');
    const { client, calls } = fakeClient([
      () => ({ status: 'fresh', etag: '"v1"', body: LIVE }),
      () => ({ status: 'not_modified' }),
    ]);
    const resolver = createCatalogResolver({
      client,
      liveEnabled: async () => true,
      appVersion: '0.5.0',
      now: time.now,
    });
    await resolver.resolve();
    time.advance(30 * 60_000);
    await resolver.resolve();
    expect(calls).toEqual([null]);
    time.advance(31 * 60_000);
    const revalidated = await resolver.resolve();
    expect(calls).toEqual([null, '"v1"']);
    expect(revalidated.status.offline).toBe(false);
  });

  it('falls back to the bundled copy when models.dev is unreachable and nothing is stored', async () => {
    const { client } = fakeClient([]);
    const resolver = createCatalogResolver({
      client,
      liveEnabled: async () => true,
      appVersion: '0.5.0',
    });
    const resolved = await resolver.resolve();
    expect(resolved.status).toMatchObject({ source: 'bundled', offline: true });
    expect(resolved.status.line).toBe('Offline · bundled with 0.5.0');
    expect(resolved.status.providerCount).toBeGreaterThan(100);
  });

  it('never asks models.dev when the live fetch is off', async () => {
    const { client, calls } = fakeClient([() => ({ status: 'fresh', etag: null, body: LIVE })]);
    const resolver = createCatalogResolver({
      client,
      liveEnabled: async () => false,
      appVersion: '0.5.0',
    });
    const resolved = await resolver.resolve();
    expect(calls).toEqual([]);
    expect(resolved.status).toMatchObject({ source: 'bundled', liveFetch: false });
  });

  it('serves an upload as the catalog and says when it was uploaded', async () => {
    const { client } = fakeClient([]);
    const resolver = createCatalogResolver({
      client,
      liveEnabled: async () => false,
      appVersion: '0.5.0',
      now: () => new Date('2026-10-02T09:00:00Z'),
    });
    const uploaded = await resolver.upload(LIVE);
    expect(uploaded.status.line).toBe('Offline · uploaded 2 October 2026');
    expect(await resolver.cached()).toHaveProperty('acme');
  });
});

describe('catalog data', () => {
  it('trims models.dev entries to the fields Bemmoly reads', () => {
    const data = trimCatalog(LIVE);
    expect(data['acme']).not.toHaveProperty('description');
    expect(data['acme']?.models['acme-mini']).toEqual({
      id: 'acme-mini',
      name: 'Acme Mini',
      tool_call: true,
      release_date: '2026-09-01',
      cost: { input: 0.1, output: 0.4 },
    });
    expect(() => trimCatalog([])).toThrow();
  });

  it('keeps tool calling for the strong role and suggests a default per role', () => {
    const data = trimCatalog({
      acme: {
        ...LIVE.acme,
        models: {
          'acme-mini': { id: 'acme-mini', name: 'Mini', tool_call: true },
          'acme-pro': { id: 'acme-pro', name: 'Pro', tool_call: true, release_date: '2026-08-01' },
          'acme-chat': { id: 'acme-chat', name: 'Chat', tool_call: false },
          'acme-embed': { id: 'acme-embed', name: 'Embed' },
        },
      },
    });
    const provider = data['acme']!;
    expect(eligibleRoles(provider.models['acme-chat']!)).toEqual(['fast', 'standard']);
    expect(eligibleRoles(provider.models['acme-embed']!)).toEqual(['embedding']);
    expect(suggestedDefaults(provider)).toMatchObject({
      fast: 'acme-mini',
      strong: 'acme-pro',
      embedding: 'acme-embed',
    });
  });

  it('refuses logos with anything active in them', () => {
    expect(safeSvg('<svg><path d="M0 0"/></svg>')).toContain('<path');
    expect(safeSvg('<svg onload="alert(1)"></svg>')).toBeNull();
    expect(safeSvg('<svg><script>alert(1)</script></svg>')).toBeNull();
    expect(safeSvg('<html></html>')).toBeNull();
  });

  it('refuses logos that reach out or hide a scheme, and keeps self-contained ones', () => {
    for (const svg of [
      '<svg><a href="https://evil.test"><path/></a></svg>',
      '<svg><use href="https://evil.test/sprite.svg#a"/></svg>',
      '<svg><image xlink:href="https://evil.test/track.png"/></svg>',
      '<svg><use href="&#106;avascript:alert(1)"/></svg>',
      '<svg><animate attributeName="href" to="#x"/></svg>',
      '<svg><set attributeName="href" to="#x"/></svg>',
      '<svg><style>@import url(https://evil.test/a.css);</style></svg>',
      '<svg><rect style="fill:url(https://evil.test/p)"/></svg>',
      '<svg><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>',
    ]) {
      expect(safeSvg(svg), svg).toBeNull();
    }
    expect(safeSvg('<svg><use href="#mark"/><rect fill="url(#g)"/></svg>')).not.toBeNull();
    expect(safeSvg('<svg><image xlink:href="data:image/png;base64,iVBOR"/></svg>')).not.toBeNull();
    expect(safeSvg('<svg><style>.a{fill:currentColor}</style></svg>')).not.toBeNull();
  });

  it('keeps every bundled logo', () => {
    const logos = JSON.parse(
      gunzipSync(readFileSync(new URL('./bundled/logos.json.gz', import.meta.url))).toString(),
    ) as Record<string, string>;
    const kept = Object.values(logos).filter((svg) => safeSvg(svg) !== null);
    expect(kept.length).toBe(Object.keys(logos).length);
  });

  it('words relative times', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    expect(relativeTime(new Date('2026-10-10T09:59:30Z'), now)).toBe('just now');
    expect(relativeTime(new Date('2026-10-10T09:00:00Z'), now)).toBe('1 hour ago');
    expect(relativeTime(new Date('2026-10-08T10:00:00Z'), now)).toBe('2 days ago');
  });
});
