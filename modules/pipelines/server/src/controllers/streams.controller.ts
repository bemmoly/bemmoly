import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { streamsQuerySchema, type StreamEvent } from '../../../shared/streams.ts';
import type { StreamsService } from '../services/streams/index.ts';

/** Proxies close idle connections; a comment line every 15 seconds keeps a quiet stream open. */
const HEARTBEAT_MS = 15_000;

function frame(event: StreamEvent): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * GET /streams: one server-sent events stream per tab. The reply is taken over from Fastify
 * once the person is authorised, so errors before that still get the standard error body.
 */
export function createStreamsController(service: StreamsService) {
  return {
    async open(request: FastifyRequest, reply: FastifyReply) {
      const { topics } = parseOrThrow(streamsQuerySchema, request.query);
      const raw = reply.raw;
      const buffered: StreamEvent[] = [];
      let ready = false;
      const send = (event: StreamEvent) => {
        if (ready) raw.write(frame(event));
        else buffered.push(event);
      };
      const session = await service.open(contextOf(request), topics, send);
      reply.hijack();
      raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
        'x-request-id': request.id,
      });
      raw.write('retry: 3000\n\n');
      for (const event of [...session.initial, ...buffered]) raw.write(frame(event));
      ready = true;
      const heartbeat = setInterval(() => raw.write(': ping\n\n'), HEARTBEAT_MS);
      request.raw.once('close', () => {
        clearInterval(heartbeat);
        session.close();
      });
    },
  };
}

export type StreamsController = ReturnType<typeof createStreamsController>;
