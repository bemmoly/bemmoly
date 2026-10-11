import { describe, expect, it, vi } from 'vitest';
import { contextWhere } from '../test-support.ts';
import type { IssueServiceDeps } from './deps.ts';
import { rankIssue } from './lifecycle.ts';

/*
 * Pins what the move body's neighbours mean: `beforeIssueId` is the row that
 * ends up above the issue (the smaller rank) and `afterIssueId` the row below
 * it. Every client builds its drop on this reading, so it must not flip.
 */

const projectId = '0199c0de-0000-7000-8000-000000000900';
const movingId = '0199c0de-0000-7000-8000-000000000910';
const aboveId = '0199c0de-0000-7000-8000-000000000911';
const belowId = '0199c0de-0000-7000-8000-000000000912';

const moving = { id: movingId, project_id: projectId, sprint_id: null, rank: 'x' };

vi.mock('./rows.ts', () => ({
  loadIssueByKey: async () => moving,
  loadIssueById: async () => moving,
  toIssue: (row: unknown) => row,
}));
vi.mock('./notify.ts', () => ({ publishIssueChange: async () => undefined }));
vi.mock('../history/index.ts', () => ({ recordHistory: async () => undefined }));

/** Answers the neighbour lookups from `ranks` and records the rank the update writes. */
function scripted(ranks: Record<string, string>) {
  const written: string[] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    if (text.startsWith('select rank from issues')) {
      const rank = ranks[values[0] as string];
      return Promise.resolve(rank ? [{ rank }] : []);
    }
    if (text.startsWith('update issues set rank')) written.push(values[0] as string);
    return Promise.resolve([]);
  };
  const client = Object.assign(tag, {
    begin: async (work: (tx: unknown) => Promise<unknown>) => work(client),
  });
  const deps = { database: client } as unknown as IssueServiceDeps;
  return { deps, written: () => written[0] ?? '' };
}

describe('rankIssue', () => {
  it('lands below beforeIssueId and above afterIssueId', async () => {
    const { deps, written } = scripted({ [aboveId]: 'c', [belowId]: 'm' });
    await rankIssue(deps, contextWhere(true), 'PLT-1', {
      beforeIssueId: aboveId,
      afterIssueId: belowId,
    });
    expect(written() > 'c').toBe(true);
    expect(written() < 'm').toBe(true);
  });

  it('goes to the top with only afterIssueId and to the end with only beforeIssueId', async () => {
    const top = scripted({ [belowId]: 'c' });
    await rankIssue(top.deps, contextWhere(true), 'PLT-1', {
      beforeIssueId: null,
      afterIssueId: belowId,
    });
    expect(top.written() < 'c').toBe(true);

    const end = scripted({ [aboveId]: 'm' });
    await rankIssue(end.deps, contextWhere(true), 'PLT-1', {
      beforeIssueId: aboveId,
      afterIssueId: null,
    });
    expect(end.written() > 'm').toBe(true);
  });

  it('refuses neighbours given the wrong way round', async () => {
    const { deps } = scripted({ [aboveId]: 'c', [belowId]: 'm' });
    await expect(
      rankIssue(deps, contextWhere(true), 'PLT-1', {
        beforeIssueId: belowId,
        afterIssueId: aboveId,
      }),
    ).rejects.toThrow();
  });
});
