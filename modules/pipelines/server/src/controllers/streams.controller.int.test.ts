import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { streamsRoutes } from '../routes/streams.routes.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../testing/harness.ts';
import { createStreamsController } from './streams.controller.ts';

describe('live stream lifetime', () => {
  let harness: PipelinesHarness | undefined;
  let app: FastifyInstance | undefined;
  let base = '';
  let reason = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    const { services, users } = started.harness;
    harness = started.harness;
    app = Fastify();
    app.addHook('onRequest', async (request) => {
      const ctx = started.harness.as(users.member);
      request.actor = ctx.actor;
      request.authz = ctx.authz;
    });
    await app.register(streamsRoutes(createStreamsController(services.streams, { maxAgeMs: 200 })));
    await app.listen({ port: 0, host: '127.0.0.1' });
    base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await harness?.services.streams.hub.stop();
    await app?.close();
    await harness?.stop();
  });

  it('ends a stream after its maximum age so the browser reconnects through sign-in', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const response = await fetch(`${base}/streams?topics=capacity`);
    expect(response.status).toBe(200);
    const body = await Promise.race([
      response.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('still open')), 3000)),
    ]);
    expect(body).toContain('retry: 1000');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(harness.services.streams.hub.size()).toBe(0);
  });
});
