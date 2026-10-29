import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { myTeams } from './teams.ts';

/*
 * A team's main is broken by the first failed run on main started after its last passing one.
 * Runs overlap, so "after" is by when they started: a passing run that began before the
 * failure but finished after it says nothing about the failing commit.
 */

describe("a team's main", () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let team = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    const [row] = await harness.sql<{ id: string }[]>`
      insert into teams (name) values ('Checkout web') returning id`;
    team = row!.id;
    await harness.sql`
      insert into team_members (team_id, user_id) values (${team}, ${harness.users.member})`;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const run = (sha: string, state: string, startedMinutesAgo: number, endedMinutesAgo: number) =>
    harness!.sql`
      insert into pipeline_runs (trigger, ref, commit_sha, title, state, team_id, created_at,
        finished_at)
      values ('push', 'main', ${sha}, ${sha}, ${state}, ${team},
        now() - make_interval(mins => ${startedMinutesAgo}),
        now() - make_interval(mins => ${endedMinutesAgo}))`;

  it('stays broken when an earlier passing run finishes after the failure', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await run('aaaa111', 'passed', 30, 2);
    await run('bbbb222', 'failed', 12, 8);
    const [mine] = await myTeams(harness.sql, harness.users.member);
    expect(mine).toMatchObject({ team: { name: 'Checkout web' }, mainState: 'broken' });
  });

  it('is healthy again once a run started after the failure passes', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    await run('cccc333', 'passed', 5, 1);
    const [mine] = await myTeams(harness.sql, harness.users.member);
    expect(mine?.mainState).toBe('healthy');
  });
});
