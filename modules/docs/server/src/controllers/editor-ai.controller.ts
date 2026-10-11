import { Readable } from 'node:stream';
import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { commentIdParamsSchema, type PageComment } from '../../../shared/comments.ts';
import {
  aiWriteBodySchema,
  completionBodySchema,
  type AiWriteStreamEvent,
  type CompletionResponse,
} from '../../../shared/editor-ai.ts';
import type { EditorAiService } from '../services/editor-ai/index.ts';
import { pageIdOf } from './pages.controller.ts';

/** Aborts the model call when the person's browser goes away before the answer is sent. */
function abortOnClose(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}

/** One JSON object per line, flushed as each arrives. */
async function* ndjson(events: AsyncIterable<AiWriteStreamEvent>): AsyncIterable<string> {
  for await (const event of events) yield `${JSON.stringify(event)}\n`;
}

export function createEditorAiController(service: EditorAiService) {
  return {
    async complete(request: FastifyRequest, reply: FastifyReply): Promise<CompletionResponse> {
      const body = parseOrThrow(completionBodySchema, request.body);
      return service.complete(contextOf(request), pageIdOf(request), body, abortOnClose(reply));
    },
    async write(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
      const body = parseOrThrow(aiWriteBodySchema, request.body);
      const events = await service.write(
        contextOf(request),
        pageIdOf(request),
        body,
        abortOnClose(reply),
      );
      reply.type('application/x-ndjson; charset=utf-8').header('cache-control', 'no-store');
      return reply.send(Readable.from(ndjson(events)));
    },
    async suggestFix(request: FastifyRequest): Promise<PageComment> {
      const { commentId } = parseOrThrow(commentIdParamsSchema, request.params);
      return service.suggestFix(contextOf(request), commentId);
    },
  };
}

export type EditorAiController = ReturnType<typeof createEditorAiController>;
