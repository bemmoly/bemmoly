import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../../clients/postgres.ts';
import { createLocalEventBus } from '../../../modules/local-event-bus.ts';
import { ModuleRegistry } from '../../../modules/registry.ts';
import { loadModules } from '../../../modules/loader.ts';
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
} from '../../../testing/isolated-database.ts';
import { createTestInsights, moduleWithAi } from '../../../testing/insights.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import type { RequestContext } from '../../authz/index.ts';
import { createJobsService, type JobsService } from '../../jobs/index.ts';
import { defineContextBuilder } from '../context/index.ts';
import { createTestAi } from '../test-ai.ts';
import { createInsightsService } from './service.ts';

let server: TestDatabase;
let database: IsolatedDatabase | undefined;
let sql: SqlClient | undefined;
const jobs: JobsService[] = [];
const people: Record<'rohan' | 'aisha' | 'away', string> = { rohan: '', aisha: '', away: '' };

/** 06:00 in Kolkata (UTC+5:30). */
const SIX_IN_KOLKATA = new Date('2026-10-12T00:30:00Z');

const activity = () =>
  moduleWithAi('notes', {
    aiContextBuilders: [
      defineContextBuilder('notes.activity', 'What changed in notes', {
        type: 'activity',
        async collect(writer, { userId }) {
          if (userId !== people.rohan) return;
          writer.heading('Waiting on you');
          writer.cite({
            kind: 'issue',
            objectId: '00000000-0000-7000-8000-000000000204',
            label: 'PLT-204',
            line: 'PLT-204 · Move sessions to Postgres · In review · waiting on you since Thursday',
            href: '/work/issue/PLT-204',
            counts: 'updates',
          });
        },
      }),
    ],
  });

const ctxFor = (id: string): RequestContext => ({
  actor: { kind: 'user', id },
  authz: { authorize: async () => undefined } as unknown as RequestContext['authz'],
});

beforeAll(async () => {
  server = await startTestDatabase();
  if (!server.available) return;
  database = await createIsolatedDatabase(server.url);
  sql = createSqlClient(database.url, { maxConnections: 6 });
  await applyKernelChangelog(sql);
  const add = async (name: string, zone: string, seenDaysAgo: number) => {
    const [row] = await sql!<{ id: string }[]>`
      insert into users (email, name, role_id, timezone, last_seen_at)
      select ${`${name}@acme.test`}, ${name}, id, ${zone},
        now() - make_interval(days => ${seenDaysAgo})
      from roles where key = 'member' returning id`;
    return row!.id;
  };
  people.rohan = await add('Rohan S.', 'Asia/Kolkata', 1);
  people.aisha = await add('Aisha K.', 'Asia/Kolkata', 2);
  people.away = await add('Away P.', 'Asia/Kolkata', 40);
});

afterAll(async () => {
  for (const service of jobs) await service.stop();
  await sql?.end({ timeout: 5 });
  await database?.drop();
  if (server.available) await server.stop();
});

describe('the morning brief', () => {
  it('is due at local 6 a.m. for people seen lately, and once per local day', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const ai = createTestAi();
    const t = createTestInsights({ ai, database: sql, modules: [activity()], now: SIX_IN_KOLKATA });
    expect(await t.insights.sweepBriefs()).toBe(2);
    expect(t.jobs.map((job) => job.options.key).sort()).toEqual(
      [
        `morning_brief:${people.aisha}:2026-10-12`,
        `morning_brief:${people.rohan}:2026-10-12`,
      ].sort(),
    );
    t.setNow(new Date('2026-10-12T01:30:00Z'));
    expect(await t.insights.sweepBriefs()).toBe(0);
  });

  it('is built from the activity sources, and an empty day costs no model call', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const ai = createTestAi();
    ai.addPrompt('ai.brief', {
      role: 'standard',
      system: 'Brief.',
      prompt: 'For {{person}}:\n{{context}}',
      outputSchema: 'morning_brief',
    });
    ai.queue({
      object: {
        points: [{ text: 'PLT-204 is waiting on your review.', cites: ['c1'] }],
        next: [{ label: 'Review PLT-204', cite: 'c1' }],
      },
    });
    const t = createTestInsights({ ai, database: sql, modules: [activity()], now: SIX_IN_KOLKATA });
    await t.insights.sweepBriefs();
    await t.drain();
    expect(ai.calls).toHaveLength(1);
    expect(JSON.stringify(ai.calls[0])).toContain('For Rohan:');

    const brief = await t.insights.get(ctxFor(people.rohan), 'morning_brief', people.rohan);
    expect(brief).toMatchObject({ state: 'ready', targetKind: 'user' });
    expect(brief.content?.citations[0]).toMatchObject({
      label: 'PLT-204',
      href: '/work/issue/PLT-204',
    });
    expect(t.realtime).toContainEqual({
      kind: 'ai.insight',
      ids: [people.rohan],
      userId: people.rohan,
    });

    const empty = await t.insights.get(ctxFor(people.aisha), 'morning_brief', people.aisha);
    expect(empty.content?.output).toEqual({ points: [], next: [] });

    await expect(
      t.insights.get(ctxFor(people.aisha), 'morning_brief', people.rohan),
    ).rejects.toThrow();
  });
});

describe('regeneration jobs on pg-boss', () => {
  it('keeps one waiting job per target however often it is asked', async (ctx) => {
    if (!sql || !database) return ctx.skip(server.available ? 'no database' : server.reason);
    const queue = createJobsService({
      sql,
      databaseUrl: database.url,
      role: 'api',
      logger: pino({ level: 'silent' }),
      modules: loadModules({ available: [] }),
    });
    jobs.push(queue);
    const events = createLocalEventBus();
    const insights = createInsightsService({
      ai: createTestAi(),
      database: sql,
      jobs: queue,
      realtime: { publish: async () => undefined },
      events,
      modules: new ModuleRegistry(),
      isEnabled: () => true,
    });
    insights.start();
    await queue.start([]);
    const ask = () =>
      events.publish({
        kind: 'ai.insight.requested',
        occurredAt: new Date(),
        payload: { kind: 'sprint_pulse', targetIds: [people.rohan], quietSeconds: 300 },
      });
    await ask();
    await ask();
    await ask();
    const rows = await sql<{ count: string }[]>`
      select count(*) as count from pgboss.job
      where name = 'ai.insight' and state in ('created', 'retry')`;
    expect(Number(rows[0]?.count)).toBe(1);
  });
});
