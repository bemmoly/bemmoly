import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  apiErrorBodySchema,
  modulesResponseSchema,
  readinessResponseSchema,
} from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { shippedModules, TEST_ENV } from './test-support.ts';

describe('buildApp', () => {
  it('answers liveness and reports degraded readiness without a database', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: await shippedModules(), logger: false });
    const live = await app.inject({ method: 'GET', url: '/healthz' });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ready.statusCode).toBe(200);
    expect(readinessResponseSchema.parse(ready.json()).status).toBe('degraded');
  });

  it('returns 503 when the configured database cannot be reached', async () => {
    const database = { ping: async () => Promise.reject(new Error('ECONNREFUSED')) };
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      database,
      logger: false,
    });
    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ status: 'unavailable' });
  });

  it('lists registered module manifests, including docs, sample and work', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: await shippedModules(), logger: false });
    const response = await app.inject({ method: 'GET', url: '/api/v1/modules' });
    expect(response.statusCode).toBe(200);
    expect(modulesResponseSchema.parse(response.json())).toEqual({
      items: [
        {
          id: 'docs',
          name: 'Docs',
          version: '0.2.0',
          navigation: [
            { id: 'docs.home', label: 'Docs', path: '/docs', placement: 'top' },
            { id: 'docs.create-page', label: 'Page', path: '/docs/create', placement: 'create' },
            {
              id: 'docs.create-space',
              label: 'Space',
              path: '/docs/spaces/new',
              placement: 'create',
            },
          ],
          search: [{ kind: 'docs.page', label: 'Pages' }],
          icon: 'doc',
          color: 'brand-2',
          order: 20,
          sidebar: {
            path: '/docs',
            links: [],
            primary: [],
            add: { create: 'docs.create-space', label: 'New space' },
          },
        },
        {
          id: 'sample',
          name: 'Sample',
          version: '0.0.0',
          navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
          icon: 'box',
          color: 'epic-4',
          order: 90,
          sidebar: { path: '/sample', links: [], primary: [] },
        },
        {
          id: 'work',
          name: 'Work',
          version: '0.2.0',
          navigation: [
            { id: 'work.home', label: 'Work', path: '/work/board', placement: 'top' },
            { id: 'work.board', label: 'Board', path: '/work/board', placement: 'command' },
            { id: 'work.backlog', label: 'Backlog', path: '/work/backlog', placement: 'command' },
            {
              id: 'work.projects',
              label: 'Projects',
              path: '/work/projects',
              placement: 'command',
            },
            { id: 'work.create-issue', label: 'Issue', path: '/work/create', placement: 'create' },
            {
              id: 'work.create-project',
              label: 'Project',
              path: '/work/projects/new',
              placement: 'create',
            },
          ],
          search: [{ kind: 'work.issue', label: 'Issues' }],
          icon: 'board',
          color: 'brand-1',
          order: 10,
          sidebar: {
            path: '/work/projects',
            links: [
              {
                id: 'work.all-projects',
                label: 'All projects',
                path: '/work/projects',
                icon: 'layers',
              },
            ],
            primary: [
              { id: 'work.my-issues', label: 'My issues', path: '/work/my-issues', icon: 'me' },
            ],
            add: { create: 'work.create-project', label: 'New project' },
          },
        },
      ],
    });
  });

  it('echoes a plain upstream request id and generates one otherwise', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: await shippedModules(), logger: false });
    const kept = await app.inject({
      url: '/healthz',
      headers: { 'x-request-id': 'edge-1234abcd' },
    });
    expect(kept.headers['x-request-id']).toBe('edge-1234abcd');
    const replaced = await app.inject({
      url: '/healthz',
      headers: { 'x-request-id': 'bad id <script>' },
    });
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers unknown API routes with the error body', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: await shippedModules(), logger: false });
    const response = await app.inject({ method: 'GET', url: '/api/v1/nothing-here' });
    expect(response.statusCode).toBe(404);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body.code).toBe('not_found');
    expect(body.requestId).toBe(response.headers['x-request-id']);
  });

  it('serves the web build and falls back to index.html for client routes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bemmoly-web-'));
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>Bemmoly</title>');
    writeFileSync(join(root, 'assets', 'index-abc.js'), 'export {};');
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      webRoot: root,
      logger: false,
    });
    const index = await app.inject({ url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.body).toContain('<title>Bemmoly</title>');
    const deep = await app.inject({ url: '/sample' });
    expect(deep.statusCode).toBe(200);
    expect(deep.headers['content-type']).toContain('text/html');
    const asset = await app.inject({ url: '/assets/index-abc.js' });
    expect(asset.headers['cache-control']).toContain('immutable');
    const api = await app.inject({ url: '/api/v1/missing' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ code: 'not_found' });
  });
});
