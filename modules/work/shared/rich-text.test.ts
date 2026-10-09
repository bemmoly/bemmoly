import { describe, expect, it } from 'vitest';
import type { RichText } from './common.ts';
import { mentionedUserIds, richTextToPlain } from './rich-text.ts';

const aisha = '0199c0de-0000-7000-8000-000000000001';
const jonas = '0199c0de-0000-7000-8000-000000000002';

const doc: RichText = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Backfill   finished, ' },
        { type: 'mention', attrs: { id: aisha, label: 'Aisha K.' } },
        { type: 'text', text: ' please confirm.' },
      ],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Then ' }, { type: 'hardBreak' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'mention', attrs: { id: jonas } },
                { type: 'mention', attrs: { id: aisha } },
                { type: 'mention', attrs: { id: 'not-a-user' } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('rich text helpers', () => {
  it('flattens a document to text with one line per block', () => {
    expect(richTextToPlain(doc)).toBe('Backfill finished, @Aisha K. please confirm.\nThen\n@@@');
    expect(richTextToPlain(null)).toBe('');
    expect(richTextToPlain({ type: 'doc' })).toBe('');
  });

  it('lists each mentioned person once, in order, ignoring ids that are not users', () => {
    expect(mentionedUserIds(doc)).toEqual([aisha, jonas]);
    expect(mentionedUserIds(null)).toEqual([]);
  });

  it('collapses long whitespace runs in linear time', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: `a${' \n'.repeat(50_000)}b` }] },
      ],
    };
    const started = performance.now();
    expect(richTextToPlain(doc as never)).toBe('a\nb');
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('keeps the plain-text shadow it produced before', () => {
    const text = 'one  two\t\tthree \n\n  four\n';
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    };
    expect(richTextToPlain(doc as never)).toBe('one two three\nfour');
  });
});
