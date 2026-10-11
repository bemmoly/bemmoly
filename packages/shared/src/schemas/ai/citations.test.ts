import { describe, expect, it } from 'vitest';
import type { AiAnswerSource } from './answers.ts';
import { citedIds, describeSources, readAnswer } from './citations.ts';

const offered = new Set(['c1', 'c2', 'c3']);

const source = (id: string, kind: string, targetId: string): AiAnswerSource => ({
  id,
  kind,
  targetId,
  title: targetId,
  href: `/x/${targetId}`,
  location: { label: 'Body' },
  noun: kind === 'docs.page' ? { one: 'page', other: 'pages' } : { one: 'issue', other: 'issues' },
});

describe('citations', () => {
  it('lists offered ids in first-use order and ignores invented ones', () => {
    expect(citedIds('Flip the flag [c2]. Redis stays warm [c1, c2, c9].', offered)).toEqual([
      'c2',
      'c1',
    ]);
  });

  it('marks a factual sentence without a citation as unsourced', () => {
    const [block] = readAnswer(
      'Flip auth_pg_sessions off [c1]. Sessions then fall back to Redis within minutes. Why?',
      offered,
    );
    expect(block!.sentences).toEqual([
      { text: 'Flip auth_pg_sessions off.', citations: ['c1'], unsourced: false },
      { text: 'Sessions then fall back to Redis within minutes.', citations: [], unsourced: true },
      { text: 'Why?', citations: [], unsourced: false },
    ]);
  });

  it('reads list items and paragraphs as separate blocks', () => {
    const blocks = readAnswer(
      'Steps:\n\n- Flip the flag off [c1].\n- Watch error rates [c3].',
      offered,
    );
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'item', 'item']);
    expect(blocks[2]!.sentences[0]!.citations).toEqual(['c3']);
  });

  it('counts the distinct records the cited sources come from', () => {
    const sources = [
      source('c1', 'docs.page', 'p1'),
      source('c2', 'docs.page', 'p1'),
      source('c3', 'docs.page', 'p2'),
      source('c4', 'work.issue', 'i1'),
    ];
    expect(describeSources(sources)).toBe('2 pages, 1 issue');
    expect(describeSources(sources, ['c1', 'c2'])).toBe('1 page');
  });
});
