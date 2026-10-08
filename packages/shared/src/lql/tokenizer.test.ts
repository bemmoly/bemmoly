import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenizer.ts';

function kinds(text: string): string[] {
  const result = tokenize(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.map((token) =>
    token.kind === 'eof' ? 'eof' : `${token.kind}:${token.text}`,
  );
}

describe('tokenize', () => {
  it('reads the query from the tech design', () => {
    expect(
      kinds(
        'project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC',
      ),
    ).toEqual([
      'word:project',
      'operator:=',
      'word:PLT',
      'keyword:AND',
      'word:status',
      'operator:!=',
      'word:Done',
      'keyword:AND',
      'word:assignee',
      'operator:=',
      'word:me',
      'keyword:AND',
      'string:"spec doc"',
      'keyword:IS',
      'keyword:EMPTY',
      'keyword:ORDER',
      'keyword:BY',
      'word:updated',
      'keyword:DESC',
      'eof',
    ]);
  });

  it('keeps hyphens inside words so labels and keys stay whole', () => {
    expect(kinds('label = tech-debt AND key = PLT-142')).toEqual([
      'word:label',
      'operator:=',
      'word:tech-debt',
      'keyword:AND',
      'word:key',
      'operator:=',
      'word:PLT-142',
      'eof',
    ]);
  });

  it('tells dates, durations, numbers and functions apart', () => {
    const result = tokenize(
      'created >= 2026-01-31T10:00Z AND due < -7d AND estimate > 2.5 AND due <= startOfWeek()',
    );
    if (!result.ok) throw new Error(result.error.message);
    const typed = result.value.filter((token) =>
      ['date', 'duration', 'number', 'function'].includes(token.kind),
    );
    expect(typed).toMatchObject([
      { kind: 'date', text: '2026-01-31T10:00Z' },
      { kind: 'duration', amount: -7, unit: 'd' },
      { kind: 'number', value: 2.5 },
      { kind: 'function', value: 'startOfWeek' },
    ]);
  });

  it('matches keywords regardless of case and keeps the spelling', () => {
    const result = tokenize('a = 1 and b = 2 order by c asc');
    if (!result.ok) throw new Error(result.error.message);
    const keywords = result.value.filter((token) => token.kind === 'keyword');
    expect(keywords.map((token) => token.value)).toEqual(['AND', 'ORDER', 'BY', 'ASC']);
    expect(keywords.map((token) => token.text)).toEqual(['and', 'order', 'by', 'asc']);
  });

  it('unescapes quoted strings and records their full span', () => {
    const result = tokenize('title ~ "say \\"hi\\" \\\\ now"');
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value[2]).toMatchObject({
      kind: 'string',
      value: 'say "hi" \\ now',
      span: { position: 8, length: 19 },
    });
  });

  it('reads every two-character operator before its one-character prefix', () => {
    expect(kinds('a!=b a!~b a<=b a>=b a<b a>b a~b')).toEqual([
      'word:a',
      'operator:!=',
      'word:b',
      'word:a',
      'operator:!~',
      'word:b',
      'word:a',
      'operator:<=',
      'word:b',
      'word:a',
      'operator:>=',
      'word:b',
      'word:a',
      'operator:<',
      'word:b',
      'word:a',
      'operator:>',
      'word:b',
      'word:a',
      'operator:~',
      'word:b',
      'eof',
    ]);
  });

  it('positions tokens by character offset', () => {
    const result = tokenize('  status IN (Done, "In review")');
    if (!result.ok) throw new Error(result.error.message);
    expect(
      result.value.map((token) => [token.kind, token.span.position, token.span.length]),
    ).toEqual([
      ['word', 2, 6],
      ['keyword', 9, 2],
      ['lparen', 12, 1],
      ['word', 13, 4],
      ['comma', 17, 1],
      ['string', 19, 11],
      ['rparen', 30, 1],
      ['eof', 31, 0],
    ]);
  });

  it('reports an unterminated string from its opening quote to the end', () => {
    expect(tokenize('summary ~ "unfinished')).toEqual({
      ok: false,
      error: { message: 'Missing closing quote', position: 10, length: 11, expected: ['"'] },
    });
  });

  it('reports a character the language has no use for', () => {
    expect(tokenize('status = Done # x')).toEqual({
      ok: false,
      error: { message: 'Unexpected character "#"', position: 14, length: 1 },
    });
  });
});
