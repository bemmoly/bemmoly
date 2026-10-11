import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { abortOnClose } from './abort-on-close.ts';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A slow POST route over a real socket, reporting whether its signal aborted meanwhile. */
async function serve(): Promise<{ port: number; aborted: Promise<boolean> }> {
  let settle: (aborted: boolean) => void = () => undefined;
  const aborted = new Promise<boolean>((resolve) => (settle = resolve));
  app = Fastify();
  app.post('/slow', async (_request, reply) => {
    const signal = abortOnClose(reply);
    await new Promise((resolve) => setTimeout(resolve, 150));
    settle(signal.aborted);
    return { aborted: signal.aborted };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  return { port: (app.server.address() as AddressInfo).port, aborted };
}

describe('abortOnClose', () => {
  it('keeps the work going once the request body has been read', async () => {
    const { port, aborted } = await serve();
    const response = await fetch(`http://127.0.0.1:${port}/slow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'How do we roll back?' }),
    });
    expect(await response.json()).toEqual({ aborted: false });
    expect(await aborted).toBe(false);
  });

  it('aborts the work when the client goes away first', async () => {
    const { port, aborted } = await serve();
    const call = request({ port, host: '127.0.0.1', method: 'POST', path: '/slow' });
    call.on('error', () => undefined);
    call.setHeader('content-type', 'application/json');
    call.end('{}');
    setTimeout(() => call.destroy(), 30);
    expect(await aborted).toBe(true);
  });
});
