import type { IncomingHttpHeaders } from 'node:http';
import {
  collabDocumentName,
  createAuditRecorder,
  createCollabHandle,
  createCollabHost,
  createDatabase,
  createRequestAuthorization,
  kernelRoutes,
  loadModules,
  type CollabHost,
  type JobDefinition,
  type SessionResolver,
} from '@bemmoly/core';
import { connectCollabClient } from '@bemmoly/core/testing';
import { isBemmolyError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import docs from '../../../../module.ts';
import type { DocsHarness } from '../int-support.ts';
import { createDocsServices, type DocsServices } from '../index.ts';
import { DOCS_COMPACT_JOB } from './index.ts';

export const ORIGIN = 'http://localhost:5190';

/** One cookie per person: `session=<user id>`, as the identity service resolves it. */
const sessions: SessionResolver = {
  async resolve(headers: IncomingHttpHeaders) {
    const id = /session=([\w-]+)/.exec(headers.cookie ?? '')?.[1];
    return id
      ? { actor: { kind: 'user', id }, sessionId: `s-${id}`, expiresAt: new Date(Date.now() + 1e6) }
      : null;
  },
  isAllowedOrigin: (headers) => headers.origin === ORIGIN,
};

export interface CollabServer {
  url: string;
  host: CollabHost;
  /** Services wired as module.ts wires them, with ctx.collab going through this host. */
  services: DocsServices;
  /** Jobs the module asked for, with their idempotency keys. */
  enqueued: { name: string; payload: unknown; key: string | undefined }[];
  compactJob: JobDefinition;
  open(userId: string, pageId: string): ReturnType<typeof connectCollabClient>;
  stop(): Promise<void>;
}

/**
 * The Docs module behind a real /collab endpoint on a random port: the kernel's host and
 * routes, the module loaded as the server loads it, a fake session resolver and a recording
 * job queue. Stopping it is a server restart: the next one starts from the database alone.
 */
export async function startCollabServer(
  harness: DocsHarness,
  options: { compactThreshold?: number } = {},
): Promise<CollabServer> {
  const handle = createCollabHandle();
  const enqueued: CollabServer['enqueued'] = [];
  const settings = {
    read: async (key: string) => (key === 'docs.compactThreshold' ? options.compactThreshold : 90),
  };
  const jobQueue = {
    register: () => undefined,
    enqueue: async (name: string, payload: object, enqueue?: { key?: string }) => {
      enqueued.push({ name, payload, key: enqueue?.key });
      return `job-${enqueued.length}`;
    },
  };
  const registry = loadModules({
    available: [docs],
    enabled: ['docs'],
    database: harness.sql,
    collab: handle,
    settingsReader: settings,
    jobQueue,
  });
  const db = createDatabase(harness.sql);
  const host = createCollabHost({
    documents: () => registry.collabDocuments(),
    contextFor: (actor) => ({
      actor,
      authz: createRequestAuthorization({ db, modules: registry }),
    }),
    logger: pino({ level: 'silent' }),
    changeDebounceMs: 100,
    maxChangeDebounceMs: 400,
  });
  handle.bind(host);
  const app: FastifyInstance = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const status = isBemmolyError(error) ? (error.code === 'unauthenticated' ? 401 : 403) : 500;
    return reply.code(status).send({ code: isBemmolyError(error) ? error.code : 'internal' });
  });
  await app.register(kernelRoutes({ modules: registry, sessions, collab: host }));
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const url = `${address.replace('http', 'ws')}/collab`;
  const compactJob = registry
    .get('docs')
    ?.contributions.jobs.find((job) => job.name === DOCS_COMPACT_JOB);
  if (!compactJob) throw new Error('docs.compact is not registered');
  const services = createDocsServices({
    database: harness.sql,
    audit: createAuditRecorder(harness.sql),
    collab: {
      transact: (kind, id, change, actor) =>
        handle.transact(collabDocumentName(kind, id), change, actor ?? null),
    },
    jobs: { send: async () => null },
  });
  return {
    url,
    host,
    services,
    enqueued,
    compactJob,
    open: (userId, pageId) =>
      connectCollabClient({
        url,
        name: collabDocumentName('docs.page', pageId),
        headers: { cookie: `session=${userId}`, origin: ORIGIN },
      }),
    async stop() {
      await host.stop();
      await app.close();
    },
  };
}
