import { describe, expect, it } from 'vitest';
import { docToText, isEmptyDoc, textToDoc } from './rich-text-convert.ts';
import { formatMinutes, parseDuration, statusTone, typeGlyph } from './vocabulary.ts';

describe('issue vocabulary', () => {
  it('paints review and QA statuses in their own tones and the rest by category', () => {
    expect(statusTone('todo', 'Backlog')).toBe('todo');
    expect(statusTone('in_progress', 'In progress')).toBe('progress');
    expect(statusTone('in_progress', 'Code review')).toBe('review');
    expect(statusTone('in_progress', 'Testing')).toBe('qa');
    expect(statusTone('done', "Won't do")).toBe('done');
  });

  it('draws custom types by their level', () => {
    expect(typeGlyph({ key: 'story' })).toBe('story');
    expect(typeGlyph({ key: 'initiative', level: 'epic' })).toBe('epic');
    expect(typeGlyph({ key: 'chore', level: 'standard' })).toBe('task');
    expect(typeGlyph(undefined)).toBe('task');
  });

  it('reads and prints work log durations', () => {
    expect(parseDuration('4h')).toBe(240);
    expect(parseDuration('1h 30m')).toBe(90);
    expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('1.5')).toBe(90);
    expect(parseDuration('soon')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(240)).toBe('4h');
    expect(formatMinutes(20)).toBe('20m');
  });
});

describe('rich text as text', () => {
  it('round-trips paragraphs, bullets, numbered items and checklists', () => {
    const text = [
      'Move sessions to Postgres.',
      '- Zero session loss\n- p95 under 8 ms',
      '1. Dual-write\n2. Cut over',
      '[x] Schema\n[ ] Backfill',
    ].join('\n\n');
    const doc = textToDoc(text);
    expect(doc?.['content']).toHaveLength(4);
    expect(docToText(doc)).toBe(text);
  });

  it('keeps line breaks inside a paragraph and treats whitespace as no document', () => {
    expect(docToText(textToDoc('one\ntwo'))).toBe('one\ntwo');
    expect(textToDoc('  \n \n')).toBeNull();
    expect(isEmptyDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
  });
});
