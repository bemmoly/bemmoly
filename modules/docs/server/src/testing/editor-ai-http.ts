import type { TestAi } from '@bemmoly/core/testing';
import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  NotFoundError,
  ProviderError,
  ValidationError,
} from '@bemmoly/shared';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { createDocsControllers } from '../controllers/index.ts';
import { createEditorAiController } from '../controllers/editor-ai.controller.ts';
import { editorAiRoutes } from '../routes/editor-ai.routes.ts';
import { docsRoutes } from '../routes/index.ts';
import { createEditorAiService } from '../services/editor-ai/index.ts';
import type { DocsServices } from '../services/index.ts';
import type { DocsHarness } from '../services/int-support.ts';

/*
 * The editor AI routes beside the rest of Docs, on a test AI, as the server mounts them: the
 * person from x-test-user, and typed errors mapped to status codes with their details, so a
 * test can read a refusal's reason.
 */

const STATUS: ReadonlyArray<[new (...args: never[]) => Error, number]> = [
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [ValidationError, 400],
  [ConflictError, 409],
  [ProviderError, 502],
];

export interface EditorAiHttp {
  app: FastifyInstance;
  call(
    url: string,
    options: { as: string; body?: unknown; method?: 'POST' | 'GET' },
  ): Promise<LightMyRequestResponse>;
}

export async function startEditorAiHttp(
  harness: DocsHarness,
  ai: TestAi,
  services: DocsServices = harness.services,
): Promise<EditorAiHttp> {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const known = isBemmolyError(error);
    const status = known ? (STATUS.find(([type]) => error instanceof type)?.[1] ?? 500) : 500;
    return reply.code(status).send({
      code: known ? error.code : 'internal',
      message: (error as Error).message,
      ...(known && error.details !== undefined ? { details: error.details } : {}),
    });
  });
  app.addHook('onRequest', async (request) => {
    const userId = request.headers['x-test-user'];
    if (typeof userId !== 'string') return;
    const ctx = harness.as(userId);
    request.actor = ctx.actor;
    request.authz = ctx.authz;
  });
  const service = createEditorAiService({
    database: harness.sql,
    ai,
    attachSuggestion: (id, suggestion) => services.comments.attachSuggestion(id, suggestion),
  });
  await app.register(docsRoutes(createDocsControllers(services)), { prefix: '/api/v1/docs' });
  await app.register(editorAiRoutes(createEditorAiController(service)), {
    prefix: '/api/v1/docs',
  });
  await app.ready();
  return {
    app,
    call: (url, options) =>
      app.inject({
        method: options.method ?? 'POST',
        url: `/api/v1/docs${url}`,
        headers: { 'x-test-user': options.as },
        ...(options.body !== undefined ? { payload: options.body as object } : {}),
      }),
  };
}

/** The NDJSON lines of a streamed write. */
export const lines = (response: LightMyRequestResponse) =>
  response.body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
