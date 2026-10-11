import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/*
 * A local HTTP receiver for webhook delivery tests: it records every request with its raw
 * body and answers with whatever the test scripted next (a status, a redirect, or silence
 * until the sender gives up). Test-only.
 */

export interface ReceivedRequest {
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

export type ReceiverAnswer =
  | { status: number; body?: string }
  | { redirect: string }
  /** Never answers; the sender's timeout must end the call. */
  | { hang: true };

export interface WebhookReceiver {
  url(path?: string): string;
  received: ReceivedRequest[];
  /** Answers queued for the next requests; once empty, every request gets `fallback`. */
  answers: ReceiverAnswer[];
  fallback: ReceiverAnswer;
  close(): Promise<void>;
}

export async function startWebhookReceiver(): Promise<WebhookReceiver> {
  const received: ReceivedRequest[] = [];
  const answers: ReceiverAnswer[] = [];
  const state = { fallback: { status: 200, body: 'ok' } as ReceiverAnswer };
  const hanging = new Set<() => void>();
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      received.push({
        path: request.url ?? '/',
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      const answer = answers.shift() ?? state.fallback;
      if ('hang' in answer) {
        hanging.add(() => response.destroy());
        return;
      }
      if ('redirect' in answer) {
        response.writeHead(302, { location: answer.redirect }).end();
        return;
      }
      response.writeHead(answer.status, { 'content-type': 'text/plain' }).end(answer.body ?? '');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path = '/hooks') => `http://127.0.0.1:${port}${path}`,
    received,
    answers,
    get fallback() {
      return state.fallback;
    },
    set fallback(answer: ReceiverAnswer) {
      state.fallback = answer;
    },
    async close() {
      for (const end of hanging) end();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
