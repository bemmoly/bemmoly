import { ForbiddenError, isBemmolyError, searchResponseSchema } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineModule } from '../modules/contract.ts';
import { loadModules } from '../modules/loader.ts';
import type { RequestAuthorization } from '../services/authz/index.ts';
import { kernelRoutes } from './index.ts';

const STATUS: Record<string, number> = {
  ValidationError: 400,
  ForbiddenError: 403,
  UnauthenticatedError: 401,
};

const issues = vi.fn(async (_ctx: unknown, query: { q: string; limit: number }) =>
  Array.from({ length: 3 }, (_, index) => ({
    id: `i${index}`,
    key: `PLT-${index + 1}`,
    title: `${query.q} ${index}`,
    subtitle: 'To do',
    href: `/work/issues/PLT-${index + 1}`,
  })),
);

const tracker = defineModule({
  id: 'tracker',
  version: '0.1.0',
  coreApi: '^0.1.0',
  defaultAccess: 'everyone',
  changelog: [],
  register(ctx) {
    ctx.search.addProvider({ kind: 'tracker.issue', label: 'Issues', search: issues });
  },
});

const wiki = defineModule({
  id: 'wiki',
  version: '0.1.0',
  coreApi: '^0.1.0',
  defaultAccess: 'everyone',
  changelog: [],
  register(ctx) {
    ctx.search.addProvider({
      kind: 'wiki.page',
      label: 'Docs',
      search: async () => {
        throw new ForbiddenError('No pages for you');
      },
    });
  },
});

async function build(options: { signedIn: boolean; reachable: readonly string[] }) {
  const registry = loadModules({ available: [tracker, wiki] });
  const app = Fastify();
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = isBemmolyError(error) ? (STATUS[error.name] ?? 500) : (error.statusCode ?? 500);
    void reply.code(status).send({ code: isBemmolyError(error) ? error.code : 'internal_error' });
  });
  app.addHook('onRequest', async (request) => {
    if (!options.signedIn) return;
    request.actor = { kind: 'user', id: 'u1' };
    request.authz = {
      modulesFor: async () => new Set(options.reachable),
    } as unknown as RequestAuthorization;
  });
  await app.register(kernelRoutes({ modules: registry }));
  return app;
}

describe('search route', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    issues.mockClear();
  });

  it('answers 401 without a signed-in person', async () => {
    app = await build({ signedIn: false, reachable: [] });
    const response = await app.inject({ url: '/api/v1/search?q=session' });
    expect(response.statusCode).toBe(401);
  });

  it('labels each provider’s results with its kind and group, capped at the limit', async () => {
    app = await build({ signedIn: true, reachable: ['tracker', 'wiki'] });
    const response = await app.inject({ url: '/api/v1/search?q=session&limit=2' });
    expect(response.statusCode).toBe(200);
    const body = searchResponseSchema.parse(response.json());
    expect(body.items).toEqual([
      expect.objectContaining({ kind: 'tracker.issue', group: 'Issues', key: 'PLT-1' }),
      expect.objectContaining({ kind: 'tracker.issue', group: 'Issues', key: 'PLT-2' }),
    ]);
    expect(issues).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { kind: 'user', id: 'u1' } }),
      {
        q: 'session',
        limit: 2,
      },
    );
  });

  it('asks only providers of modules the person can open and the kinds asked for', async () => {
    app = await build({ signedIn: true, reachable: ['wiki'] });
    const none = await app.inject({ url: '/api/v1/search?q=session' });
    expect(none.json()).toEqual({ items: [] });
    expect(issues).not.toHaveBeenCalled();
    await app.close();
    app = await build({ signedIn: true, reachable: ['tracker', 'wiki'] });
    const filtered = await app.inject({ url: '/api/v1/search?q=session&kinds=wiki.page,user' });
    expect(filtered.json()).toEqual({ items: [] });
    expect(issues).not.toHaveBeenCalled();
  });

  it('lists each module search group in its manifest, for the palette scopes', async () => {
    app = await build({ signedIn: true, reachable: ['tracker', 'wiki'] });
    const response = await app.inject({ url: '/api/v1/modules' });
    expect(response.json().items).toEqual([
      expect.objectContaining({
        id: 'tracker',
        search: [{ kind: 'tracker.issue', label: 'Issues' }],
      }),
      expect.objectContaining({ id: 'wiki', search: [{ kind: 'wiki.page', label: 'Docs' }] }),
    ]);
  });

  it('refuses a provider kind outside the module namespace', () => {
    const stray = defineModule({
      ...tracker,
      id: 'stray',
      register(ctx) {
        ctx.search.addProvider({ kind: 'issue', label: 'Issues', search: issues });
      },
    });
    expect(() => loadModules({ available: [stray] })).toThrow(/must be namespaced as "stray/);
  });

  it('refuses an empty query', async () => {
    app = await build({ signedIn: true, reachable: ['tracker'] });
    const response = await app.inject({ url: '/api/v1/search?q=%20' });
    expect(response.statusCode).toBe(400);
  });
});
