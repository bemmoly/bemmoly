import type { Http } from '@bemmoly/api-client';
import { describe, expect, it } from 'vitest';
import { docsLibraryEndpoints } from './api/library.ts';
import { docsPagesEndpoints } from './api/pages.ts';
import { DOCS_SCREENS, resolveDocsRoute } from './routes.tsx';

describe('resolveDocsRoute', () => {
  it('maps the Docs paths to their screens', () => {
    expect(resolveDocsRoute('')).toMatchObject({ name: 'home', props: { segment: undefined } });
    expect(resolveDocsRoute('/s/ENG')).toMatchObject({
      Screen: DOCS_SCREENS['s'],
      name: 's',
      props: { segment: 'ENG', rest: [] },
    });
    expect(resolveDocsRoute('/p/0199c0de-0000-7000-8000-000000000001/history')).toMatchObject({
      name: 'p',
      props: { segment: '0199c0de-0000-7000-8000-000000000001', rest: ['history'] },
    });
  });

  it('sends the top bar create entries to the home and refuses the rest', () => {
    expect(resolveDocsRoute('/create')?.name).toBe('home');
    expect(resolveDocsRoute('/spaces/new')?.name).toBe('home');
    expect(resolveDocsRoute('/nowhere')).toBeNull();
  });
});

describe('docs endpoints', () => {
  const calls: Array<{ path: string; options: Parameters<Http['send']>[1] }> = [];
  const http: Http = {
    request: async (path, _schema, options) => {
      calls.push({ path, options });
      return {} as never;
    },
    send: async (path, options) => {
      calls.push({ path, options });
    },
    upload: async () => ({}) as never,
    url: (path) => path,
  };

  it('address spaces by key and pages by id under /api/v1/docs', async () => {
    const pages = docsPagesEndpoints(http);
    const library = docsLibraryEndpoints(http);
    await pages.spaces.tree('ENG', { parentId: '0199c0de-0000-7000-8000-000000000001' });
    await pages.pages.move('0199c0de-0000-7000-8000-000000000002', { parentId: null });
    await library.stars.set('0199c0de-0000-7000-8000-000000000002', false);
    await pages.pages.remove('0199c0de-0000-7000-8000-000000000002');
    expect(calls.map((call) => [call.options?.method ?? 'GET', call.path])).toEqual([
      ['GET', '/api/v1/docs/spaces/ENG/tree'],
      ['POST', '/api/v1/docs/pages/0199c0de-0000-7000-8000-000000000002/move'],
      ['DELETE', '/api/v1/docs/pages/0199c0de-0000-7000-8000-000000000002/star'],
      ['DELETE', '/api/v1/docs/pages/0199c0de-0000-7000-8000-000000000002'],
    ]);
    expect(calls[0]?.options?.query).toEqual({
      parentId: '0199c0de-0000-7000-8000-000000000001',
      limit: 50,
    });
  });
});
