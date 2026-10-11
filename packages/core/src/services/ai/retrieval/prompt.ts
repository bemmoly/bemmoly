import { fileURLToPath } from 'node:url';
import type { RetrievedChunk } from './retrieve.ts';

/**
 * "Ask your docs" reads its prompt from answer.prompt.md, loaded with the kernel prompts, so
 * admins can override it in Settings › AI › Prompts. The id is recorded on ai_runs and predates
 * the "ai." namespace, so it keeps its own.
 */
export const ANSWER_PROMPT_ID = 'retrieval.answer';
export const ANSWER_PROMPT_FILE = fileURLToPath(new URL('./answer.prompt.md', import.meta.url));

/** What the model writes when the sources do not answer the question; never shown. */
export const NO_ANSWER = 'NO_ANSWER';

/** The volatile part of the prompt: the numbered sources and the question. */
export function answerVariables(
  question: string,
  chunks: readonly RetrievedChunk[],
): { sources: string; question: string } {
  const sources = chunks.map(({ source, text }) => {
    const place = source.location.label ? ` (${source.location.label})` : '';
    return `[${source.id}] ${source.title}${place}\n${text}`;
  });
  return { sources: sources.join('\n\n'), question };
}
