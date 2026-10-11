import { describe, expect, it } from 'vitest';
import { splitText } from './chunks.ts';
import { fuseRankings } from './rrf.ts';

describe('fuseRankings', () => {
  it('puts what both lists found ahead of what one list found first', () => {
    expect(
      fuseRankings([
        ['a', 'b', 'c'],
        ['c', 'd'],
      ]),
    ).toEqual(['c', 'a', 'b', 'd']);
  });

  it('sums every list an item is in and counts an item once per list', () => {
    expect(
      fuseRankings([
        ['x', 'y'],
        ['y', 'x'],
        ['y', 'y'],
      ]),
    ).toEqual(['y', 'x']);
  });

  it('keeps first-seen order on ties and copes with empty lists', () => {
    expect(fuseRankings([['a'], [], ['b']])).toEqual(['a', 'b']);
    expect(fuseRankings([])).toEqual([]);
  });
});

describe('splitText', () => {
  it('keeps short text whole and drops empty text', () => {
    expect(splitText('One line.')).toEqual(['One line.']);
    expect(splitText('   ')).toEqual([]);
  });

  it('splits long text at sentence boundaries within the limit', () => {
    const text = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const pieces = splitText(text, 80);
    expect(pieces.every((piece) => piece.length <= 80)).toBe(true);
    expect(pieces.join(' ')).toBe(text);
  });

  it('cuts a sentence longer than the limit at a word', () => {
    const pieces = splitText('word '.repeat(100).trim(), 50);
    expect(pieces.every((piece) => piece.length <= 50 && !piece.startsWith(' '))).toBe(true);
  });
});
