import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  DEFAULT_TARGET,
  rewriteRequest,
  rewriteResponse,
  type ImportTarget,
} from '../jira/rewrite.ts';

/*
 * A reverse proxy in front of the fake Jira site, which listens only on loopback: it answers
 * on any address (so a VM or another machine can reach it) and rewrites names both ways.
 */

const TIMEOUT_MS = 60_000;

async function readAll(stream: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export interface ProxyStats {
  requests: number;
  bytesOut: number;
}

export async function startProxy(
  target: string,
  host: string,
  port: number,
  project: ImportTarget = DEFAULT_TARGET,
) {
  const upstream = new URL(target);
  const stats: ProxyStats = { requests: 0, bytesOut: 0 };
  const server: Server = createServer(async (req, res) => {
    stats.requests += 1;
    const body = await readAll(req);
    const forwarded = body.length
      ? Buffer.from(rewriteRequest(body.toString('utf8'), project))
      : body;
    const headers = { ...req.headers, host: upstream.host };
    delete headers['content-length'];
    if (forwarded.length) headers['content-length'] = String(forwarded.length);
    const outbound = request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        method: req.method,
        path: rewriteRequest(req.url ?? '/', project),
        headers,
        timeout: TIMEOUT_MS,
      },
      async (answer) => {
        const raw = await readAll(answer);
        const json = (answer.headers['content-type'] ?? '').includes('json');
        const out = json ? Buffer.from(rewriteResponse(raw.toString('utf8'), project)) : raw;
        // The body is re-sent whole, so it carries a length and not the upstream's chunking.
        const replyHeaders = { ...answer.headers, 'content-length': String(out.length) };
        delete replyHeaders['transfer-encoding'];
        delete replyHeaders.connection;
        stats.bytesOut += out.length;
        res.writeHead(answer.statusCode ?? 502, replyHeaders);
        res.end(out);
      },
    );
    outbound.on('timeout', () => outbound.destroy(new Error('upstream timeout')));
    outbound.on('error', (error) => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(error.message);
    });
    outbound.end(forwarded);
  });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    stats,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
