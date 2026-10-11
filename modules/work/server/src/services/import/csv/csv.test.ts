import { describe, expect, it } from 'vitest';
import { rankFor } from '../writer.ts';
import { columnMappings, mapColumns } from './columns.ts';
import { parseCsv } from './parse.ts';

describe('parseCsv', () => {
  it('reads quotes, doubled quotes, line breaks in fields and CRLF', () => {
    const parsed = parseCsv('﻿Key,Summary\r\nA-1,"Hello, ""world"""\r\nA-2,"two\nlines"\r\n\r\n');
    expect(parsed.headers).toEqual(['Key', 'Summary']);
    expect(parsed.rows).toEqual([
      ['A-1', 'Hello, "world"'],
      ['A-2', 'two\nlines'],
    ]);
  });

  it('detects a semicolon separator', () => {
    expect(parseCsv('Key;Title\nA-1;One').rows).toEqual([['A-1', 'One']]);
  });

  it('refuses an unterminated quote and a file without a header', () => {
    expect(() => parseCsv('Key,Title\nA-1,"open')).toThrow(/quoted field/);
    expect(() => parseCsv('')).toThrow(/header/);
  });
});

describe('columns', () => {
  it('matches the headers common exports use and reports the rest', () => {
    const headers = ['Issue key', 'Title', 'Assigned To', 'Story Points', 'Votes'];
    expect([...mapColumns(headers).entries()]).toEqual([
      ['key', 0],
      ['title', 1],
      ['assignee', 2],
      ['estimate', 3],
    ]);
    expect(columnMappings(headers).at(-1)).toMatchObject({ source: 'Votes', action: 'report' });
  });
});

describe('rankFor', () => {
  it('orders issues by number with valid lexoranks', () => {
    const ranks = [1, 2, 26, 27, 10_000, 300_000].map(rankFor);
    expect([...ranks].sort()).toEqual(ranks);
    for (const rank of ranks) expect(rank).toMatch(/^[a-z]*[b-z]$/);
  });
});
