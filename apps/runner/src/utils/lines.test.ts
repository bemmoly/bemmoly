import { describe, expect, it } from 'vitest';
import { LineSplitter, MAX_LINE_LENGTH, stripAnsi } from './lines.ts';

function collect(feed: (splitter: LineSplitter) => void): string[] {
  const lines: string[] = [];
  const splitter = new LineSplitter((line) => lines.push(line));
  feed(splitter);
  splitter.end();
  return lines;
}

describe('line splitting', () => {
  it('joins partial lines across chunks and keeps the last unterminated one', () => {
    expect(
      collect((s) => {
        s.push('hel');
        s.push('lo\nwor');
        s.push('ld\r\nlast');
      }),
    ).toEqual(['hello', 'world', 'last']);
  });

  it('keeps the final frame of a carriage-return progress line', () => {
    expect(collect((s) => s.push('10%\r50%\r100%\n'))).toEqual(['100%']);
  });

  it('keeps a multi-byte character split across chunks', () => {
    const bytes = Buffer.from('café\n');
    expect(
      collect((s) => {
        s.push(bytes.subarray(0, 4));
        s.push(bytes.subarray(4));
      }),
    ).toEqual(['café']);
  });

  it('cuts a line longer than the contract allows', () => {
    const lines = collect((s) => s.push(`${'x'.repeat(MAX_LINE_LENGTH + 10)}\n`));
    expect(lines.map((l) => l.length)).toEqual([MAX_LINE_LENGTH, 10]);
  });

  it('strips colour codes', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red');
  });
});
