/**
 * Structured-output repair: when the reply does not parse or does not match the schema, the
 * model gets one more turn with the validation error, then the call fails with a typed error.
 */
const REPAIRABLE = new Set([
  'AI_NoObjectGeneratedError',
  'AI_NoOutputGeneratedError',
  'AI_TypeValidationError',
  'AI_JSONParseError',
]);

export function isRepairable(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return typeof name === 'string' && REPAIRABLE.has(name);
}

/** The validation problem in a few lines, never the whole reply. */
function problemOf(error: unknown): string {
  const shape = error as { message?: string; cause?: { message?: string } } | null;
  const text = shape?.cause?.message ?? shape?.message ?? 'The reply was not valid JSON.';
  return text.length > 1500 ? `${text.slice(0, 1500)}…` : text;
}

/** The text the model gave, when the error carries it, so it can see what to fix. */
function replyOf(error: unknown): string | null {
  const text = (error as { text?: unknown } | null)?.text;
  return typeof text === 'string' && text.length > 0 ? text.slice(0, 8000) : null;
}

export function repairMessages<M extends { role: string; content: unknown }>(
  messages: readonly M[],
  error: unknown,
): M[] {
  const reply = replyOf(error);
  const next = [...messages];
  if (reply) next.push({ role: 'assistant', content: reply } as M);
  next.push({
    role: 'user',
    content:
      'Your previous answer did not match the required JSON schema. ' +
      `The problem: ${problemOf(error)}\n` +
      'Answer again with only JSON that matches the schema exactly.',
  } as M);
  return next;
}
