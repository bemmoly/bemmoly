import { sql } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { Precondition } from '../../contracts/changelog.ts';
import { describeVerdict, failingInPlan, type Probe } from './plan-preconditions.ts';
import { createPlannedSchema } from './plan-schema.ts';

const usersExist: Precondition = { tableExists: { table: 'users' }, onFail: 'halt' };
const noUsersYet: Precondition = { rowCount: { table: 'users', expected: 0 }, onFail: 'skip' };

/** A database where nothing exists yet. */
const emptyDatabase: Probe = vi.fn(async () => false);

describe('failingInPlan', () => {
  it('holds when an earlier pending changeset creates the table', async () => {
    const schema = createPlannedSchema();
    schema.record('CREATE TABLE users (id uuid PRIMARY KEY);');
    const verdict = await failingInPlan([usersExist], {
      schema,
      probe: emptyDatabase,
      earlierPending: true,
    });
    expect(verdict).toBeUndefined();
  });

  it('halts when nothing earlier in the plan creates the table', async () => {
    const verdict = await failingInPlan([usersExist], {
      schema: createPlannedSchema(),
      probe: emptyDatabase,
      earlierPending: true,
    });
    expect(verdict).toEqual({ precondition: usersExist, deferred: false });
    expect(describeVerdict(verdict!)).toBe('precondition tableExists users does not hold');
  });

  it('defers a failing data check while earlier changesets would run first', async () => {
    const probe: Probe = vi.fn(async () => {
      throw new Error('relation "users" does not exist');
    });
    const verdict = await failingInPlan([noUsersYet], {
      schema: createPlannedSchema(),
      probe,
      earlierPending: true,
    });
    expect(verdict).toMatchObject({ precondition: noUsersYet, deferred: true });
    expect(describeVerdict(verdict!)).toMatch(/update checks it again .*\(onFail: skip\)$/);
  });

  it('reports the onFail outcome for a data check when nothing runs before it', async () => {
    const check: Precondition = {
      sqlCheck: { query: sql`select 1`, expected: 2 },
      onFail: 'markRan',
    };
    const verdict = await failingInPlan([check], {
      schema: createPlannedSchema(),
      probe: emptyDatabase,
      earlierPending: false,
    });
    expect(verdict).toEqual({ precondition: check, deferred: false });
  });

  it('prefers a definite failure over a deferred one', async () => {
    const verdict = await failingInPlan([noUsersYet, usersExist], {
      schema: createPlannedSchema(),
      probe: emptyDatabase,
      earlierPending: true,
    });
    expect(verdict).toEqual({ precondition: usersExist, deferred: false });
  });
});
