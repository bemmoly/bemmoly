import { AI_ROLES } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { AiPolicy } from '../../../contracts/ai.ts';
import { activityWindowStart } from './activity.ts';
import { keepKnownCitations } from './citations.ts';
import { clip, createContextWriter } from './writer.ts';

const policy = (change: Partial<AiPolicy> = {}): AiPolicy => ({
  enabled: true,
  shareContent: true,
  redactEmails: false,
  redactNames: false,
  excludedSpaceIds: [],
  excludedProjectIds: [],
  allowActions: true,
  perUserOptOutAllowed: true,
  optedOutUserIds: [],
  actorOptedOut: false,
  budgetState: 'unlimited',
  availableRoles: AI_ROLES,
  ...change,
});

const SECRET = 'the rollback plan is to flip auth_pg_sessions';

function write(p: AiPolicy) {
  const writer = createContextWriter({ policy: p });
  writer.heading('Issue');
  writer.cite({
    kind: 'issue',
    objectId: 'i1',
    label: 'PLT-204',
    line: 'PLT-204 · Move sessions to Postgres · In review',
    body: SECRET,
    scope: { projectId: 'p1', authorId: 'u1' },
    counts: 'issues',
  });
  writer.heading('Comments');
  writer.cite({
    kind: 'comment',
    objectId: 'k1',
    label: "Jonas M.'s comment",
    line: 'Jonas M. · Thursday',
    body: 'Waiting on review of #4821',
    scope: { projectId: 'p1', authorId: 'u2' },
    counts: 'comments',
  });
  return writer.build({ projectId: 'p1' }, { key: 'PLT-204' });
}

describe('the context writer', () => {
  it('numbers citations in writing order and maps each to its object', () => {
    const context = write(policy());
    expect(context.text).toContain('[c1] PLT-204 · Move sessions to Postgres · In review');
    expect(context.text).toContain('[c2] Jonas M. · Thursday');
    expect(context.text.indexOf('[c1]')).toBeLessThan(context.text.indexOf('[c2]'));
    expect(context.citations.map((c) => [c.id, c.kind, c.objectId])).toEqual([
      ['c1', 'issue', 'i1'],
      ['c2', 'comment', 'k1'],
    ]);
    expect(context.source).toEqual({ counts: { issues: 1, comments: 1 }, titlesOnly: false });
  });

  it('gives the same hash for the same inputs and a new one when anything changes', () => {
    expect(write(policy()).hash).toBe(write(policy()).hash);
    expect(write(policy({ shareContent: false })).hash).not.toBe(write(policy()).hash);
  });

  it('sends no body text at all with share content off', () => {
    const context = write(policy({ shareContent: false }));
    expect(context.text).not.toContain(SECRET);
    expect(context.text).not.toContain('Waiting on review');
    expect(context.text).toContain('PLT-204 · Move sessions to Postgres · In review');
    expect(context.source.titlesOnly).toBe(true);
  });

  it("keeps an opted-out author's body home but sends everyone else's", () => {
    const context = write(policy({ optedOutUserIds: ['u2'] }));
    expect(context.text).toContain(SECRET);
    expect(context.text).not.toContain('Waiting on review');
    expect(context.text).toContain('Jonas M. · Thursday');
    expect(context.source.titlesOnly).toBe(true);
  });

  it('leaves excluded projects out entirely, titles included', () => {
    const context = write(policy({ excludedProjectIds: ['p1'] }));
    expect(context.text).not.toContain('PLT-204');
    expect(context.citations).toEqual([]);
  });

  it('stays within its character budget and cuts long bodies at a word', () => {
    const writer = createContextWriter({ policy: policy(), maxChars: 600, maxBodyChars: 120 });
    const ids = Array.from({ length: 40 }, (_, n) =>
      writer.cite({
        kind: 'comment',
        objectId: `k${n}`,
        label: `comment ${n}`,
        line: `comment ${n}`,
        body: 'word '.repeat(200),
      }),
    );
    const context = writer.build();
    expect(context.text.length).toBeLessThanOrEqual(600);
    expect(ids.filter(Boolean).length).toBe(context.citations.length);
    expect(ids.at(-1)).toBeNull();
    expect(context.text).toContain('…');
  });

  it('clips at a word boundary', () => {
    expect(clip('alpha beta gamma delta', 12)).toBe('alpha beta…');
    expect(clip('short', 12)).toBe('short');
  });
});

describe('citations in model output', () => {
  const offered = write(policy()).citations;

  it('drops invented ids so the claim reads as unsourced, and invented steps whole', () => {
    const { output, citations } = keepKnownCitations(
      {
        points: [
          { text: 'Waiting on review.', cites: ['c2', 'c9', 'c2'] },
          { text: 'Made up.', cites: ['c42'] },
        ],
        next: [
          { label: 'Open PLT-204', cite: 'c1' },
          { label: 'Do magic', cite: 'c77' },
        ],
      },
      offered,
    );
    expect(output.points).toEqual([
      { text: 'Waiting on review.', cites: ['c2'] },
      { text: 'Made up.', cites: [] },
    ]);
    expect(output.next).toEqual([{ label: 'Open PLT-204', cite: 'c1' }]);
    expect(citations.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('the activity window', () => {
  const now = new Date('2026-10-12T06:00:00Z');
  it('covers since the last visit, between one day and one week', () => {
    expect(activityWindowStart(new Date('2026-10-09T17:00:00Z'), now).toISOString()).toBe(
      '2026-10-09T17:00:00.000Z',
    );
    expect(activityWindowStart(new Date('2026-10-12T05:00:00Z'), now).toISOString()).toBe(
      '2026-10-11T06:00:00.000Z',
    );
    expect(activityWindowStart(null, now).toISOString()).toBe('2026-10-05T06:00:00.000Z');
  });
});
