import type { LanguageModelMiddleware } from '../registry.ts';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Longest placeholder we may see split across stream deltas: "[PERSON_9999]". */
const HOLD_BACK = 14;

export interface RedactionOptions {
  emails: boolean;
  names: readonly string[];
}

export interface Redaction {
  /** Replaces addresses and names with stable placeholders; the same value, the same one. */
  redact(text: string): string;
  /** Puts the originals back. */
  restore(text: string): string;
  middleware: LanguageModelMiddleware;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Privacy redaction for one call: placeholders like [EMAIL_1] and [PERSON_2] go to the
 * provider, the originals come back in the output (text, tool arguments and stream deltas).
 */
export function createRedaction(options: RedactionOptions): Redaction {
  const toPlaceholder = new Map<string, string>();
  const toOriginal = new Map<string, string>();
  const counters = { EMAIL: 0, PERSON: 0 };
  const names = [...new Set(options.names.map((n) => n.trim()).filter((n) => n.length >= 3))]
    // Longest first, so "Ana Lima" wins over "Ana".
    .sort((a, b) => b.length - a.length);
  const namePattern = names.length
    ? new RegExp(`\\b(?:${names.map(escape).join('|')})\\b`, 'g')
    : null;
  const active = options.emails || namePattern !== null;

  const placeholder = (kind: 'EMAIL' | 'PERSON', value: string) => {
    const known = toPlaceholder.get(value);
    if (known) return known;
    counters[kind] += 1;
    const next = `[${kind}_${counters[kind]}]`;
    toPlaceholder.set(value, next);
    toOriginal.set(next, value);
    return next;
  };

  const redact = (text: string) => {
    if (!active) return text;
    let out = options.emails ? text.replace(EMAIL, (m) => placeholder('EMAIL', m)) : text;
    if (namePattern) out = out.replace(namePattern, (m) => placeholder('PERSON', m));
    return out;
  };
  const restore = (text: string) =>
    toOriginal.size === 0
      ? text
      : text.replace(/\[(?:EMAIL|PERSON)_\d+\]/g, (m) => toOriginal.get(m) ?? m);

  const redactPrompt = (prompt: unknown): unknown => {
    if (!Array.isArray(prompt)) return prompt;
    return prompt.map((message: { role: string; content: unknown }) => {
      if (typeof message.content === 'string')
        return { ...message, content: redact(message.content) };
      if (!Array.isArray(message.content)) return message;
      return {
        ...message,
        content: message.content.map((part: { type: string; text?: string }) =>
          part.type === 'text' && typeof part.text === 'string'
            ? { ...part, text: redact(part.text) }
            : part,
        ),
      };
    });
  };

  const restorePart = <P extends { type: string }>(part: P): P => {
    const record = part as P & { text?: string; input?: string; delta?: string };
    if (record.type === 'text' && typeof record.text === 'string') {
      return { ...part, text: restore(record.text) };
    }
    if (record.type === 'tool-call' && typeof record.input === 'string') {
      return { ...part, input: restore(record.input) };
    }
    return part;
  };

  const middleware: LanguageModelMiddleware = {
    transformParams: async ({ params }) =>
      active ? { ...params, prompt: redactPrompt(params.prompt) as typeof params.prompt } : params,
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      if (toOriginal.size === 0) return result;
      return { ...result, content: result.content.map(restorePart) };
    },
    wrapStream: async ({ doStream }) => {
      const result = await doStream();
      if (!active) return result;
      const buffers = new Map<string, string>();
      const transform = new TransformStream({
        transform(chunk: { type: string; id?: string; delta?: string }, controller) {
          if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
            const id = chunk.id ?? '';
            const text = (buffers.get(id) ?? '') + chunk.delta;
            const open = text.lastIndexOf('[');
            const keep = open >= 0 && !text.includes(']', open) && text.length - open <= HOLD_BACK;
            const ready = keep ? text.slice(0, open) : text;
            buffers.set(id, keep ? text.slice(open) : '');
            if (ready) controller.enqueue({ ...chunk, delta: restore(ready) });
            return;
          }
          if (chunk.type === 'text-end') {
            const rest = buffers.get(chunk.id ?? '') ?? '';
            if (rest)
              controller.enqueue({ type: 'text-delta', id: chunk.id, delta: restore(rest) });
            buffers.delete(chunk.id ?? '');
          }
          controller.enqueue(restorePart(chunk));
        },
      });
      return { ...result, stream: result.stream.pipeThrough(transform as never) };
    },
  };

  return { redact, restore, middleware };
}
