import { Readable } from 'node:stream';
import { parseOrThrow } from '@bemmoly/shared';
import { AI_ANSWER_CONTENT_TYPE, aiAnswerRequestSchema } from '@bemmoly/shared/ai-answers';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RetrievalService } from '../services/ai/index.ts';
import { abortOnClose } from '../utils/abort-on-close.ts';
import { contextOf } from './request-context.ts';

/** One JSON event per line; the client reads them as they arrive. */
async function* lines(events: AsyncIterable<unknown>): AsyncGenerator<string> {
  for await (const event of events) yield `${JSON.stringify(event)}\n`;
}

export function createAiAnswersController(service: RetrievalService) {
  return {
    /**
     * Refusals and bad input fail before the first byte as ordinary errors; after that the
     * answer streams as NDJSON and a failure arrives as its last event. A client that goes
     * away stops the model call.
     */
    async create(request: FastifyRequest, reply: FastifyReply): Promise<Readable> {
      const body = parseOrThrow(aiAnswerRequestSchema, request.body);
      const signal = abortOnClose(reply);
      const events = await service.answer(contextOf(request), body, signal);
      void reply.type(AI_ANSWER_CONTENT_TYPE).header('cache-control', 'no-store');
      return Readable.from(lines(events));
    },
  };
}

export type AiAnswersController = ReturnType<typeof createAiAnswersController>;
