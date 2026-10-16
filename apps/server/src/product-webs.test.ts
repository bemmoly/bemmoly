import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { shippedModules, TEST_ENV } from './test-support.ts';

function build(title: string, asset: string) {
  const root = mkdtempSync(join(tmpdir(), 'bemmoly-web-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), `<!doctype html><title>${title}</title>`);
  writeFileSync(join(root, 'assets', asset), 'export {};');
  return root;
}

describe('a product web app on the same origin', () => {
  it('serves Pipelines under /pipelines and Bemmoly everywhere else', async () => {
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      webRoot: build('Bemmoly', 'index-a.js'),
      productWebs: [{ base: '/pipelines', root: build('Bemmoly Pipelines', 'mount-b.js') }],
      logger: false,
    });
    const bare = await app.inject({ url: '/pipelines' });
    expect(bare.statusCode).toBe(302);
    expect(bare.headers.location).toBe('/pipelines/');
    const index = await app.inject({ url: '/pipelines/' });
    expect(index.body).toContain('<title>Bemmoly Pipelines</title>');
    const deep = await app.inject({ url: '/pipelines/catalog?scope=commerce' });
    expect(deep.statusCode).toBe(200);
    expect(deep.body).toContain('<title>Bemmoly Pipelines</title>');
    expect(deep.headers['cache-control']).toBe('no-cache');
    const asset = await app.inject({ url: '/pipelines/assets/mount-b.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    const work = await app.inject({ url: '/work/board' });
    expect(work.body).toContain('<title>Bemmoly</title>');
    const api = await app.inject({ url: '/api/v1/pipelines/missing' });
    expect(api.headers['content-type']).toContain('application/json');
  });

  it('leaves /pipelines to Bemmoly’s own app when Pipelines was not built', async () => {
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      webRoot: build('Bemmoly', 'index-a.js'),
      productWebs: [{ base: '/pipelines', root: join(tmpdir(), 'bemmoly-missing-build') }],
      logger: false,
    });
    expect((await app.inject({ url: '/pipelines/catalog' })).body).toContain(
      '<title>Bemmoly</title>',
    );
  });
});
