import type { DurationUnit, Span } from './ast.ts';
import type { LqlError, LqlResult } from './errors.ts';

export const KEYWORDS = [
  'AND',
  'OR',
  'NOT',
  'IN',
  'IS',
  'EMPTY',
  'ORDER',
  'BY',
  'ASC',
  'DESC',
] as const;

export type Keyword = (typeof KEYWORDS)[number];

export type Token =
  | { kind: 'word'; text: string; span: Span }
  /** `text` keeps the spelling; `value` is the upper-cased keyword the parser matches on. */
  | { kind: 'keyword'; text: string; value: Keyword; span: Span }
  /** `value` is the unescaped content; `text` is the source including quotes. */
  | { kind: 'string'; text: string; value: string; span: Span }
  | { kind: 'number'; text: string; value: number; span: Span }
  | { kind: 'date'; text: string; span: Span }
  | { kind: 'duration'; text: string; amount: number; unit: DurationUnit; span: Span }
  /** A bare name followed by `()`; `value` is the name without the parentheses. */
  | { kind: 'function'; text: string; value: string; span: Span }
  | { kind: 'operator'; text: string; span: Span }
  | { kind: 'lparen' | 'rparen' | 'comma'; text: string; span: Span }
  | { kind: 'eof'; text: ''; span: Span };

export type TokenKind = Token['kind'];

/**
 * Order matters: a date starts like a number, a duration ends like a word, and
 * `!=` must win over a lone `!`, which is not a token at all.
 */
const DATE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?(?![\w.-])/;
const DURATION = /^[+-]?\d+[hdw](?![\w.-])/;
const NUMBER = /^[+-]?\d+(?:\.\d+)?(?![\w.-])/;
const FUNCTION = /^[A-Za-z_][\w.-]*\(\)/;
const WORD = /^[A-Za-z_][\w.-]*/;
const OPERATOR = /^(?:!=|!~|<=|>=|=|<|>|~)/;
const PUNCTUATION: Record<string, 'lparen' | 'rparen' | 'comma'> = {
  '(': 'lparen',
  ')': 'rparen',
  ',': 'comma',
};

const keywordSet = new Set<string>(KEYWORDS);

export function isKeyword(text: string): text is Keyword {
  return keywordSet.has(text.toUpperCase());
}

/** Reads a double-quoted string with `\"` and `\\` escapes, starting at the opening quote. */
function readString(text: string, start: number): LqlResult<Token> {
  let value = '';
  let index = start + 1;
  while (index < text.length) {
    const char = text[index];
    if (char === '"') {
      const raw = text.slice(start, index + 1);
      return {
        ok: true,
        value: { kind: 'string', text: raw, value, span: { position: start, length: raw.length } },
      };
    }
    if (char === '\\') {
      const next = text[index + 1];
      if (next === undefined) break;
      value += next;
      index += 2;
      continue;
    }
    value += char;
    index += 1;
  }
  return {
    ok: false,
    error: {
      message: 'Missing closing quote',
      position: start,
      length: text.length - start,
      expected: ['"'],
    },
  };
}

function readAt(text: string, position: number): LqlResult<Token> {
  const rest = text.slice(position);
  const char = rest[0] as string;
  const punctuation = PUNCTUATION[char];
  if (punctuation !== undefined) {
    return { ok: true, value: { kind: punctuation, text: char, span: { position, length: 1 } } };
  }
  if (char === '"') return readString(text, position);

  const date = DATE.exec(rest);
  if (date) {
    return {
      ok: true,
      value: { kind: 'date', text: date[0], span: { position, length: date[0].length } },
    };
  }
  const duration = DURATION.exec(rest);
  if (duration) {
    const raw = duration[0];
    return {
      ok: true,
      value: {
        kind: 'duration',
        text: raw,
        amount: Number(raw.slice(0, -1)),
        unit: raw.slice(-1) as DurationUnit,
        span: { position, length: raw.length },
      },
    };
  }
  const number = NUMBER.exec(rest);
  if (number) {
    const raw = number[0];
    return {
      ok: true,
      value: {
        kind: 'number',
        text: raw,
        value: Number(raw),
        span: { position, length: raw.length },
      },
    };
  }
  const fn = FUNCTION.exec(rest);
  if (fn) {
    const raw = fn[0];
    return {
      ok: true,
      value: {
        kind: 'function',
        text: raw,
        value: raw.slice(0, -2),
        span: { position, length: raw.length },
      },
    };
  }
  const word = WORD.exec(rest);
  if (word) {
    const raw = word[0];
    const span = { position, length: raw.length };
    if (isKeyword(raw)) {
      return {
        ok: true,
        value: { kind: 'keyword', text: raw, value: raw.toUpperCase() as Keyword, span },
      };
    }
    return { ok: true, value: { kind: 'word', text: raw, span } };
  }
  const operator = OPERATOR.exec(rest);
  if (operator) {
    return {
      ok: true,
      value: {
        kind: 'operator',
        text: operator[0],
        span: { position, length: operator[0].length },
      },
    };
  }
  return {
    ok: false,
    error: { message: `Unexpected character "${char}"`, position, length: 1 },
  };
}

/** Splits query text into tokens, ending with `eof` so the parser never runs off the end. */
export function tokenize(text: string): LqlResult<Token[]> {
  const tokens: Token[] = [];
  let position = 0;
  while (position < text.length) {
    if (/\s/.test(text[position] as string)) {
      position += 1;
      continue;
    }
    const result = readAt(text, position);
    if (!result.ok) return result;
    tokens.push(result.value);
    position = result.value.span.position + result.value.span.length;
  }
  tokens.push({ kind: 'eof', text: '', span: { position: text.length, length: 0 } });
  return { ok: true, value: tokens };
}

export function unexpectedToken(token: Token, expected: string[]): LqlError {
  const what = token.kind === 'eof' ? 'Unexpected end of query' : `Unexpected "${token.text}"`;
  return {
    message: `${what}, expected ${expected.join(' or ')}`,
    position: token.span.position,
    length: token.span.length,
    expected,
  };
}
