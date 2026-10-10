import {
  BemmolyError,
  citedIds,
  type AiAnswerEvent,
  type AiAnswerRequest,
  type AiAnswerSource,
} from '@bemmoly/shared';
import type { AiStreamResult } from '../../../contracts/ai.ts';
import type { RequestContext } from '../../authz/index.ts';
import type { RetrievalDependencies } from './deps.ts';
import { ANSWER_PROMPT, ANSWER_SYSTEM, NO_ANSWER, answerPrompt } from './prompt.ts';
import { retrieve } from './retrieve.ts';

/** Room for six cited sentences; an answer longer than this is not brief. */
const MAX_OUTPUT_TOKENS = 700;

function errorEvent(error: unknown): AiAnswerEvent {
  if (error instanceof BemmolyError) {
    return {
      type: 'error',
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details as never } : {}),
      },
    };
  }
  return { type: 'error', error: { code: 'internal_error', message: 'The answer stopped' } };
}

/**
 * Holds back text while it could still be the NO_ANSWER marker, so the marker never reaches
 * the screen; once the text can no longer be it, everything held is released.
 */
function createGate() {
  let held = '';
  let open = false;
  let silenced = false;
  return {
    push(delta: string): string {
      if (silenced) return '';
      if (open) return delta;
      held += delta;
      const start = held.trimStart();
      if (start.startsWith(NO_ANSWER)) {
        silenced = true;
        return '';
      }
      if (NO_ANSWER.startsWith(start)) return '';
      open = true;
      return held;
    },
    get silenced() {
      return silenced;
    },
  };
}

async function* answerEvents(
  sources: AiAnswerSource[],
  stream: AiStreamResult | null,
): AsyncGenerator<AiAnswerEvent> {
  yield { type: 'sources', sources };
  if (!stream) {
    yield { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] };
    return;
  }
  const gate = createGate();
  try {
    for await (const delta of stream.textStream) {
      const text = gate.push(delta);
      if (text) yield { type: 'delta', text };
    }
    const result = await stream.result;
    const text = result.text.trim();
    if (gate.silenced || text === NO_ANSWER || text === '') {
      yield { type: 'done', outcome: 'no_sources', runId: result.runId, text: '', cited: [] };
      return;
    }
    const offered = new Set(sources.map((source) => source.id));
    yield {
      type: 'done',
      outcome: 'answered',
      runId: result.runId,
      text,
      cited: citedIds(text, offered),
    };
  } catch (error) {
    stream.result.catch(() => undefined);
    yield errorEvent(error);
  }
}

/**
 * "Ask your docs": refuses up front when AI is off, a needed role is unset, the budget is
 * spent or the person opted out (403 with the reason, before any byte is streamed); else
 * retrieves what the person may read and streams the standard model's cited answer. With
 * nothing relevant, says so without asking a model.
 */
export async function answerQuestion(
  deps: RetrievalDependencies,
  ctx: RequestContext,
  request: AiAnswerRequest,
  signal?: AbortSignal,
): Promise<AsyncIterable<AiAnswerEvent>> {
  const ai = deps.ai();
  await ai.assertAvailable('embedding', ctx.actor);
  await ai.assertAvailable('standard', ctx.actor);
  const context = await retrieve(deps, ctx, {
    question: request.question,
    ...(request.kinds ? { kinds: request.kinds } : {}),
  });
  if (context.chunks.length === 0) return answerEvents([], null);
  const stream = await ai.stream({
    role: 'standard',
    purpose: 'qa',
    actor: ctx.actor,
    system: ANSWER_SYSTEM,
    prompt: answerPrompt(request.question, context.chunks),
    promptRef: ANSWER_PROMPT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(signal ? { signal } : {}),
  });
  return answerEvents(context.sources, stream);
}
