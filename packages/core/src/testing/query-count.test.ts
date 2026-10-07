import { describe, expect, it } from 'vitest';
import { createQueryCounter, expectMaxQueries, QueryBudgetExceededError } from './query-count.ts';

describe('query-count assertion', () => {
  it('passes when the operation stays within its budget', async () => {
    const counter = createQueryCounter();
    const result = await expectMaxQueries(counter, 2, async () => {
      counter.record('select * from issues where project_id = $1');
      counter.record('select * from sprints where id = $1');
      return 'board';
    });
    expect(result).toBe('board');
  });

  it('fails with every statement listed when the operation runs more', async () => {
    const counter = createQueryCounter();
    const run = expectMaxQueries(counter, 1, async () => {
      for (const id of [1, 2, 3]) counter.record(`select * from issues where id = ${id}`);
    });
    await expect(run).rejects.toBeInstanceOf(QueryBudgetExceededError);
    await expect(
      expectMaxQueries(counter, 1, async () => {
        counter.record('select 1');
        counter.record('select   2\n  from x');
      }),
    ).rejects.toThrow(/at most 1 queries, ran 2:\n {2}1\. select 1\n {2}2\. select 2 from x/);
  });

  it('counts only what ran inside the budget, never transaction control', async () => {
    const counter = createQueryCounter();
    counter.record('select earlier');
    await expectMaxQueries(counter, 1, async () => {
      for (const control of ['begin', 'BEGIN READ WRITE', 'savepoint s1', 'release s1', 'commit']) {
        counter.record(control);
      }
      counter.record('update issues set rank = $1');
      counter.record('rollback');
    });
    expect(counter.count).toBe(2);
    counter.reset();
    expect(counter.statements).toEqual([]);
  });

  it('rejects a budget that is not a whole number', async () => {
    const counter = createQueryCounter();
    await expect(expectMaxQueries(counter, -1, async () => undefined)).rejects.toThrow(RangeError);
    await expect(expectMaxQueries(counter, 1.5, async () => undefined)).rejects.toThrow(RangeError);
  });
});
