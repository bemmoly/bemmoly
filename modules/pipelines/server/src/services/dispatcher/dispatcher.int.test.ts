import type { SqlClient } from '@bemmoly/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';
import { claimNextJob } from './claim.ts';
import { sweepJobs } from './sweep.ts';

/*
 * The dispatcher against a real Postgres: many workers claiming at once never share a job,
 * classes are strict, teams share by weight, concurrency keys hold, lost runners' jobs come
 * back.
 */

interface Setup {
  pool: string;
  runner: string;
  run: string;
  teams: { a: string; b: string };
}

async function ready(
  sql: SqlClient,
  setup: Setup,
  count: number,
  options: {
    team?: string | null;
    priorityClass?: string;
    concurrencyKey?: string;
    prefix?: string;
  } = {},
) {
  const prefix = options.prefix ?? `${options.team ?? 'none'}-${options.priorityClass ?? 'main'}`;
  await sql`
    insert into pipeline_jobs (run_id, key, name, state, pool_id, team_id, priority_class,
      concurrency_key, ready_at)
    select ${setup.run}, ${prefix} || '-' || n || '-' || gen_random_uuid(), 'Job ' || n, 'ready',
      ${setup.pool}, ${options.team ?? null}::uuid, ${options.priorityClass ?? 'main'},
      ${options.concurrencyKey ?? null}, now() - make_interval(secs => ${count} - n)
    from generate_series(1, ${count}) as n`;
}

describe('dispatcher', () => {
  let harness: PipelinesHarness | undefined;
  let reason = '';
  let setup: Setup;

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  beforeEach(async () => {
    if (!harness) return;
    const sql = harness.sql;
    await sql`delete from pipeline_runs`;
    await sql`delete from pipeline_runners`;
    await sql`delete from pipeline_team_shares`;
    await sql`delete from pipeline_runner_pools`;
    await sql`delete from teams`;
    const pool = (await createPool(sql, `pool-${Date.now()}`)).id;
    const [a] = await sql<{ id: string }[]>`insert into teams (name) values ('Alpha') returning id`;
    const [b] = await sql<{ id: string }[]>`insert into teams (name) values ('Beta') returning id`;
    const [runner] = await sql<{ id: string }[]>`
      insert into pipeline_runners (pool_id, name, state) values (${pool}, 'r', 'idle') returning id`;
    const [run] = await sql<{ id: string }[]>`
      insert into pipeline_runs (trigger, ref, commit_sha, title) values ('manual', 'main', 'abc1234', 't')
      returning id`;
    setup = {
      pool,
      runner: runner?.id ?? '',
      run: run?.id ?? '',
      teams: { a: a?.id ?? '', b: b?.id ?? '' },
    };
  });

  const claim = (sql: SqlClient, token = `t-${Math.random()}`) =>
    claimNextJob(sql, { poolId: setup.pool, runnerId: setup.runner, tokenHash: token });

  it('never hands one job to two of many workers claiming at once', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const sql = harness.sql;
    await ready(sql, setup, 120, { team: setup.teams.a });
    await ready(sql, setup, 80, { team: setup.teams.b });
    const workers = Array.from({ length: 10 }, async () => {
      const got: string[] = [];
      for (;;) {
        const job = await claim(sql);
        if (!job) return got;
        got.push(job.id);
      }
    });
    const claimed = (await Promise.all(workers)).flat();
    expect(claimed).toHaveLength(200);
    expect(new Set(claimed).size).toBe(200);
  });

  it('serves classes strictly and roll backs first, whatever the team', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const sql = harness.sql;
    await ready(sql, setup, 2, { team: setup.teams.a, priorityClass: 'pull_request' });
    await ready(sql, setup, 2, { team: setup.teams.b, priorityClass: 'scheduled' });
    await ready(sql, setup, 1, { team: setup.teams.b, priorityClass: 'main' });
    await ready(sql, setup, 1, { team: setup.teams.a, priorityClass: 'rollback' });
    await ready(sql, setup, 1, { team: null, priorityClass: 'deploy' });
    const order: string[] = [];
    for (let job = await claim(sql); job; job = await claim(sql)) {
      const [row] = await sql<{ priority_class: string }[]>`
        select priority_class from pipeline_jobs where id = ${job.id}`;
      order.push(row?.priority_class ?? '');
    }
    expect(order).toEqual([
      'rollback',
      'deploy',
      'main',
      'pull_request',
      'pull_request',
      'scheduled',
      'scheduled',
    ]);
  });

  it('shares slots between busy teams by weight', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const sql = harness.sql;
    await sql`
      insert into pipeline_team_shares (pool_id, team_id, weight)
      values (${setup.pool}, ${setup.teams.a}, 3), (${setup.pool}, ${setup.teams.b}, 1)`;
    await ready(sql, setup, 60, { team: setup.teams.a });
    await ready(sql, setup, 60, { team: setup.teams.b });
    const served = { a: 0, b: 0 };
    for (let i = 0; i < 40; i += 1) {
      const job = await claim(sql);
      const [row] = await sql<
        { team_id: string }[]
      >`select team_id from pipeline_jobs where id = ${job?.id ?? null}::uuid`;
      if (row?.team_id === setup.teams.a) served.a += 1;
      else served.b += 1;
    }
    expect(served).toEqual({ a: 30, b: 10 });
  });

  it('holds a concurrency key to its limit until the running job finishes', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const sql = harness.sql;
    await ready(sql, setup, 2, { team: setup.teams.a, concurrencyKey: 'deploy:checkout-api:prod' });
    const first = await claim(sql);
    expect(first).not.toBeNull();
    expect(await claim(sql)).toBeNull();
    await sql`update pipeline_jobs set state = 'passed' where id = ${first?.id ?? null}::uuid`;
    expect(await claim(sql)).not.toBeNull();
  });

  it('returns a lost runner’s job to the queue twice, then fails it with the reason', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const sql = harness.sql;
    await ready(sql, setup, 1, { team: setup.teams.a });
    const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const job = await claim(sql);
      expect(job).not.toBeNull();
      const result = await sweepJobs(sql, later(attempt));
      expect(result.requeued + result.failed).toBe(1);
    }
    const [job] = await sql<{ state: string; attempt: number; failure_summary: string }[]>`
      select state, attempt, failure_summary from pipeline_jobs`;
    expect(job).toMatchObject({ state: 'failed', attempt: 3 });
    expect(job?.failure_summary).toContain('stopped answering on all 3 attempts');
  });
});
