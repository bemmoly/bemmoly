import type { LogSpan, LogSpanKind } from '../../../../shared/logs.ts';

/*
 * A log line's escape codes → spans the LogView draws with tokens (never the colour the
 * program asked for), plus the plain text for copying and search. Only SGR codes carry
 * meaning; every other escape sequence is dropped.
 */

// The escape character is the point of this pattern.
// eslint-disable-next-line no-control-regex
const ESCAPE = /\u001b\[([0-9;]*)([A-Za-z])/g;
const URL = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/g;

/**
 * Words that mark a line as an error. "0 failed" and "errors: 0" are summaries, not errors,
 * so a count of zero next to the word clears it.
 */
const ERROR_WORDS = /\b(error|errors|fatal|panic|exception|traceback|failed|failure|fail)\b|ERR!/i;
const ZERO_COUNT = /\b0\s+(errors?|failed|failures?)\b|\b(errors?|failed|failures?)\s*[:=]\s*0\b/i;

function kindOf(codes: number[], current: LogSpanKind): LogSpanKind {
  let kind = current;
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i] ?? 0;
    if (code === 38 || code === 48) {
      // 256-colour and true-colour arguments carry no meaning we can map to a token.
      i += codes[i + 1] === 5 ? 2 : 4;
      kind = code === 38 ? 'accent' : kind;
    } else if (code === 0 || code === 39 || code === 22) kind = 'plain';
    else if (code === 1) kind = kind === 'plain' ? 'bold' : kind;
    else if (code === 2 || code === 90) kind = 'dim';
    else if (code === 31 || code === 91) kind = 'error';
    else if (code === 33 || code === 93) kind = 'warning';
    else if (code === 32 || code === 92) kind = 'success';
    else if (code === 34 || code === 94 || code === 36 || code === 96) kind = 'info';
    else if (code === 35 || code === 95) kind = 'accent';
  }
  return kind;
}

function withLinks(span: LogSpan): LogSpan[] {
  const out: LogSpan[] = [];
  let last = 0;
  for (const match of span.text.matchAll(URL)) {
    const start = match.index;
    if (start > last) out.push({ text: span.text.slice(last, start), kind: span.kind });
    out.push({ text: match[0], kind: 'link', href: match[0] });
    last = start + match[0].length;
  }
  if (last === 0) return [span];
  if (last < span.text.length) out.push({ text: span.text.slice(last), kind: span.kind });
  return out;
}

export function stripAnsi(line: string): string {
  return line.replace(ESCAPE, '');
}

export function parseAnsi(line: string): { text: string; spans: LogSpan[] } {
  const spans: LogSpan[] = [];
  let kind: LogSpanKind = 'plain';
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const previous = spans[spans.length - 1];
    if (previous && previous.kind === kind) previous.text += text;
    else spans.push({ text, kind });
  };
  for (const match of line.matchAll(ESCAPE)) {
    push(line.slice(last, match.index));
    if (match[2] === 'm') {
      const codes = (match[1] ?? '').split(';').filter(Boolean).map(Number);
      kind = kindOf(codes.length === 0 ? [0] : codes, kind);
    }
    last = match.index + match[0].length;
  }
  push(line.slice(last));
  const text = spans.map((span) => span.text).join('');
  return { text, spans: spans.flatMap(withLinks) };
}

export function isErrorLine(text: string, spans?: readonly LogSpan[]): boolean {
  if (spans?.some((span) => span.kind === 'error' && span.text.trim().length > 0)) return true;
  return ERROR_WORDS.test(text) && !ZERO_COUNT.test(text);
}
