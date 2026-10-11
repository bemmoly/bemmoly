import type { Messages } from '@lingui/core';
import { compileMessage, type CompiledMessage } from '@lingui/message-utils/compileMessage';

/*
 * The pseudo-locale (en-XA): English with every letter accented, 40% longer and bracketed,
 * so a screen shows at a glance which text is hard-coded (plain English), which is clipped
 * (no closing bracket) and which layout breaks when a language runs longer. Built from the
 * English catalogs at run time, in its own chunk, so it costs nothing until someone asks.
 */

const ACCENTS: Readonly<Record<string, string>> = Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((letter, index) => [
    letter,
    [...'áƀçðéƒĝĥíĵķļɱñöþǫŕšţüṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ'][index] ?? letter,
  ]),
);

/** Rich-text tags ("<link>…</link>") keep their names, or they would stop matching. */
const TAG = /(<\/?[A-Za-z][\w-]*>)/;

const CHOICES = new Set(['plural', 'select', 'selectordinal']);

export function pseudoText(text: string): string {
  return text
    .split(TAG)
    .map((part, index) =>
      index % 2 === 1 ? part : [...part].map((char) => ACCENTS[char] ?? char).join(''),
    )
    .join('');
}

type Token = CompiledMessage[number];

function choicesOf(token: Token): Record<string, unknown> | null {
  if (typeof token === 'string') return null;
  const [, type, format] = token;
  return type && CHOICES.has(type) && format && typeof format === 'object'
    ? (format as Record<string, unknown>)
    : null;
}

function accent(tokens: CompiledMessage): CompiledMessage {
  return tokens.map((token): Token => {
    if (typeof token === 'string') return token === '#' ? token : pseudoText(token);
    const choices = choicesOf(token);
    if (!choices) return token;
    const cases = Object.fromEntries(
      Object.entries(choices).map(([key, value]) => [
        key,
        Array.isArray(value) ? accent(value as CompiledMessage) : value,
      ]),
    );
    return [token[0], token[1], cases];
  });
}

/** Roughly how many characters the message shows: its text, "other" for a choice. */
function lengthOf(tokens: CompiledMessage): number {
  return tokens.reduce<number>((total, token) => {
    if (typeof token === 'string') return total + token.length;
    const other = choicesOf(token)?.['other'];
    return total + (Array.isArray(other) ? lengthOf(other as CompiledMessage) : 4);
  }, 0);
}

/** "Sign in" → "[Šíĝñ íñ ···]". */
export function pseudoMessage(message: string | CompiledMessage): CompiledMessage {
  const tokens = typeof message === 'string' ? compileMessage(message) : message;
  const padding = '·'.repeat(Math.max(2, Math.ceil(lengthOf(tokens) * 0.4)));
  return ['[', ...accent(tokens), ` ${padding}]`];
}

export function pseudoMessages(source: Messages): Messages {
  return Object.fromEntries(
    Object.entries(source).map(([id, message]) => [
      id,
      pseudoMessage(message as string | CompiledMessage),
    ]),
  );
}
