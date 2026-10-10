import type { AiFacade, RequestContext } from '@bemmoly/core';
import { isBemmolyError, ValidationError } from '@bemmoly/shared';
import type { PageComment } from '../../../../shared/comments.ts';
import {
  commentFixOutputSchema,
  type AiWriteBody,
  type AiWriteStreamEvent,
  type CompletionBody,
  type CompletionResponse,
} from '../../../../shared/editor-ai.ts';
import { requireDatabase, type DocsServiceDeps } from '../common.ts';
import { pageById } from '../pages/rows.ts';
import { aroundQuote, openThreadsText, threadText } from './context.ts';
import { gatePage } from './gate.ts';
import { EDITOR_PROMPTS, writePromptId } from './prompts.ts';

/*
 * AI inside the Docs editor: ghost text, the /ai commands and Ask AI, and a suggested fix on
 * a comment thread. Each call is gated (gate.ts), names its purpose and prompt so the run is
 * recorded, and writes nothing to the page: ghost text and writes come back to the editor as
 * suggestions, and a fix is stored on the thread for the apply-suggestion path to apply
 * against the live document.
 */

export const EDITOR_AI_PURPOSES = {
  complete: 'docs.autocomplete',
  write: 'docs.write',
  fix: 'docs.comment_fix',
} as const;

/** The fast role's budget for ghost text; anything slower is useless to a typist. */
export const COMPLETE_TIMEOUT_MS = 1500;

export interface EditorAiDeps extends Pick<DocsServiceDeps, 'database'> {
  ai: AiFacade;
  /** Stores a fix on an inline thread (the comments service's attachSuggestion). */
  attachSuggestion: (
    commentId: string,
    suggestion: { replacement: string; rationale?: string; runId?: string },
  ) => Promise<PageComment>;
}

interface ThreadRow {
  id: string;
  page_id: string;
  parent_id: string | null;
  anchor: { quote: string } | null;
  author_id: string | null;
  author_name: string | null;
  body_text: string;
}

/** The error line a stream ends with when it fails after it began. */
export function streamError(error: unknown): AiWriteStreamEvent {
  if (isBemmolyError(error)) {
    return {
      type: 'error',
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return { type: 'error', code: 'internal_error', message: 'Writing stopped part way. Try again.' };
}

export function createEditorAiService(deps: EditorAiDeps) {
  const sql = () => requireDatabase(deps);
  const { ai } = deps;

  return {
    /** Ghost text: a short continuation, or null. Fast role, 1.5 s, no retries. */
    async complete(
      ctx: RequestContext,
      pageId: string,
      body: CompletionBody,
      signal?: AbortSignal,
    ): Promise<CompletionResponse> {
      await gatePage(sql(), ai, ctx, pageId);
      const prompt = await ai.renderPrompt(EDITOR_PROMPTS.complete, {
        before: body.before,
        after: body.after,
      });
      const result = await ai.generate({
        role: prompt.role,
        purpose: EDITOR_AI_PURPOSES.complete,
        actor: ctx.actor,
        system: prompt.system,
        prompt: prompt.prompt,
        promptRef: prompt.promptRef,
        maxOutputTokens: 60,
        temperature: 0.2,
        timeoutMs: COMPLETE_TIMEOUT_MS,
        ...(signal ? { signal } : {}),
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      const line = result.text.split('\n')[0]?.trimEnd() ?? '';
      return { text: line.trim() ? line.slice(0, 400) : null };
    },

    /**
     * An /ai command. Gating and the model call start before this returns, so a refusal is an
     * ordinary HTTP error; after that the events stream, and a failure ends them with an
     * error line.
     */
    async write(
      ctx: RequestContext,
      pageId: string,
      body: AiWriteBody,
      signal?: AbortSignal,
    ): Promise<AsyncIterable<AiWriteStreamEvent>> {
      const page = await gatePage(sql(), ai, ctx, pageId);
      const variables: Record<string, string> = {
        heading: body.heading || page.title || 'Untitled',
        section: body.sectionText,
      };
      if (body.command === 'summarize-comments') {
        variables['comments'] = await openThreadsText(sql(), pageId, page.policy);
      } else {
        if (!body.targetText.trim() && !body.sectionText.trim()) {
          throw new ValidationError('There is no text here for AI to work on yet');
        }
        variables['target'] = body.targetText;
      }
      const prompt = await ai.renderPrompt(writePromptId(body.command), variables);
      const stream = await ai.stream({
        role: prompt.role,
        purpose: EDITOR_AI_PURPOSES.write,
        actor: ctx.actor,
        system: prompt.system,
        prompt: prompt.prompt,
        promptRef: prompt.promptRef,
        maxOutputTokens: 1200,
        ...(signal ? { signal } : {}),
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      return (async function* events(): AsyncIterable<AiWriteStreamEvent> {
        try {
          for await (const text of stream.textStream) {
            if (text) yield { type: 'text', text };
          }
          const result = await stream.result;
          yield { type: 'done', runId: result.runId };
        } catch (error) {
          yield streamError(error);
        }
      })();
    },

    /** Writes a fix for an inline thread and stores it there for Apply fix. */
    async suggestFix(ctx: RequestContext, commentId: string): Promise<PageComment> {
      const rows = await sql()<ThreadRow[]>`
        select c.id, c.page_id, c.parent_id, c.anchor, c.author_id, u.name as author_name,
          c.body_text
        from page_comments c left join users u on u.id = c.author_id
        where (c.id = ${commentId} or c.parent_id = ${commentId}) and c.deleted_at is null
        order by c.parent_id nulls first, c.created_at`;
      const root = rows[0];
      if (!root || root.id !== commentId) throw new ValidationError('That thread was not found');
      if (root.parent_id || !root.anchor) {
        throw new ValidationError('A fix belongs on a thread about some text on the page');
      }
      const page = await gatePage(sql(), ai, ctx, root.page_id);
      const stored = await pageById(sql(), root.page_id);
      const prompt = await ai.renderPrompt(EDITOR_PROMPTS.fix, {
        quote: root.anchor.quote,
        context: aroundQuote(stored.snapshot, root.anchor.quote),
        thread: threadText(rows, page.policy),
      });
      const result = await ai.generate({
        role: prompt.role,
        purpose: EDITOR_AI_PURPOSES.fix,
        actor: ctx.actor,
        system: prompt.system,
        prompt: prompt.prompt,
        promptRef: prompt.promptRef,
        schema: commentFixOutputSchema,
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      return deps.attachSuggestion(commentId, {
        replacement: result.object.replacement,
        rationale: result.object.rationale,
        runId: result.runId,
      });
    },
  };
}

export type EditorAiService = ReturnType<typeof createEditorAiService>;
