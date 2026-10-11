import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  aiWriteBodySchema,
  aiWriteEventSchema,
  completionBodySchema,
  completionResponseSchema,
  pageCommentSchema,
  type AiWriteBody,
  type AiWriteStreamEvent,
  type CompletionBody,
} from '../../../shared/index.ts';
import { DOCS_BASE } from './pages.ts';

/** AI inside the editor: ghost text, streamed /ai writes, a thread's suggested fix. */
export function docsEditorAiEndpoints(http: Http) {
  const page = (id: string, rest: string) => `${DOCS_BASE}/pages/${enc(id)}${rest}`;
  return {
    ai: {
      complete: async (pageId: string, body: CompletionBody, signal?: AbortSignal) =>
        http.request(page(pageId, '/completions'), completionResponseSchema, {
          method: 'POST',
          body: validated(completionBodySchema, body),
          ...(signal ? { signal } : {}),
        }),
      /** The write's events as they arrive; a refusal throws before the first. */
      async *write(
        pageId: string,
        body: AiWriteBody,
        signal?: AbortSignal,
      ): AsyncGenerator<AiWriteStreamEvent> {
        yield* http.lines(page(pageId, '/ai-writes'), aiWriteEventSchema, {
          method: 'POST',
          body: validated(aiWriteBodySchema, body),
          ...(signal ? { signal } : {}),
        });
      },
      suggestFix: async (commentId: string) =>
        http.request(`${DOCS_BASE}/comments/${enc(commentId)}/suggest-fix`, pageCommentSchema, {
          method: 'POST',
        }),
    },
  };
}
