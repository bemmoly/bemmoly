import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSqlClient, type SqlClient } from '../../../clients/postgres.ts';
import type { Actor } from '../../../contracts/authz.ts';
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
} from '../../../testing/isolated-database.ts';
import { createTestInsights, moduleWithAi, type TestInsights } from '../../../testing/insights.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import type { RequestContext } from '../../authz/index.ts';
import { createContextWriter, defineContextBuilder } from '../context/index.ts';
import { createTestAi, type TestAi } from '../test-ai.ts';
import { defineInsightGenerator } from './types.ts';

const SECRET = 'the secret rollback plan';
let server: TestDatabase;
let database: IsolatedDatabase | undefined;
let sql: SqlClient | undefined;
let userId = '';

/** A one-table fake module: a note with a body, in a project, by an author. */
const notes = () =>
  moduleWithAi('notes', {
    aiContextBuilders: [
      defineContextBuilder('notes.note', 'A note', {
        type: 'target',
        targetKind: 'note',
        canView: async (_ctx, id) => id !== '00000000-0000-7000-8000-00000000dead',
        async build(id, options) {
          const [note] = await sql!<{ title: string; body: string; project_id: string }[]>`
            select title, body, project_id from test_notes where id = ${id}`;
          if (!note) return null;
          const writer = createContextWriter({ policy: options.policy });
          if (writer.excluded({ projectId: note.project_id })) {
            const { aiRefusal } = await import('../refusals.ts');
            throw aiRefusal('excluded');
          }
          // As Work's issue does: the context reads differently once a summary exists.
          writer.heading(options.since ? 'Changes since the last summary' : 'Recent changes');
          writer.cite({
            kind: 'note',
            objectId: id,
            label: note.title,
            line: note.title,
            body: note.body,
            scope: { projectId: note.project_id },
            counts: 'notes',
          });
          return writer.build({ projectId: note.project_id }, { title: note.title });
        },
      }),
    ],
    aiInsightGenerators: [
      defineInsightGenerator('Note summary', {
        kind: 'issue_summary',
        builder: 'notes.note',
        promptId: 'notes.summary',
        purpose: 'summary',
      }),
    ],
  });

/** A person; `mayUseAi` false is a role without "Use AI assist" (a contractor, by default). */
const ctxFor = (id: string, mayUseAi = true): RequestContext => ({
  actor: { kind: 'user', id } satisfies Actor,
  authz: {
    authorize: async (_actor: Actor, capability: string) => {
      if (capability === 'ai.assist.use' && !mayUseAi) throw new ForbiddenError('No AI assist');
    },
  } as unknown as RequestContext['authz'],
});

const summary = (cites: string[]) => ({
  object: { points: [{ text: 'Rollback is a flag flip.', cites }], next: [] },
});

let ai: TestAi;
let t: TestInsights;
let noteId = '';
const projectId = '00000000-0000-7000-8000-0000000000aa';

beforeAll(async () => {
  server = await startTestDatabase();
  if (!server.available) return;
  database = await createIsolatedDatabase(server.url);
  sql = createSqlClient(database.url, { maxConnections: 4 });
  await applyKernelChangelog(sql);
  await sql`create table test_notes (id uuid primary key default uuidv7(), title text not null,
    body text not null, project_id uuid not null)`;
  const [user] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select 'rohan@acme.test', 'Rohan S.', id from roles where key = 'member' returning id`;
  userId = user!.id;
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await database?.drop();
  if (server.available) await server.stop();
});

beforeEach(async () => {
  if (!sql) return;
  await sql`delete from ai_insights`;
  await sql`delete from test_notes`;
  const [note] = await sql<{ id: string }[]>`
    insert into test_notes (title, body, project_id)
    values ('Session storage', ${SECRET}, ${projectId}) returning id`;
  noteId = note!.id;
  ai = createTestAi();
  ai.addPrompt('notes.summary', {
    role: 'standard',
    system: 'Summarise with citations.',
    prompt: '{{title}}\n{{context}}',
    outputSchema: 'issue_summary',
  });
  t = createTestInsights({ ai, database: sql, modules: [notes()] });
});

describe('the insight cache against a real database', () => {
  it('queues the first summary, then serves it from cache in under 10 ms', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const first = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(first).toMatchObject({ state: 'pending', content: null, id: null });
    expect(t.jobs).toHaveLength(1);

    ai.queue(summary(['c1']));
    expect(await t.drain()).toBe(1);
    expect(t.realtime).toEqual([{ kind: 'ai.insight', ids: [noteId], projectId }]);

    const timings: number[] = [];
    let ready;
    for (let n = 0; n < 5; n += 1) {
      const started = performance.now();
      ready = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
      timings.push(performance.now() - started);
    }
    timings.sort((a, b) => a - b);
    expect(timings[2]).toBeLessThan(10);
    expect(ready).toMatchObject({ state: 'ready', kind: 'issue_summary' });
    expect(ready!.content?.citations.map((c) => c.objectId)).toEqual([noteId]);
    expect(ready!.content?.source).toEqual({ counts: { notes: 1 }, titlesOnly: false });
    expect(t.jobs).toHaveLength(1);
    expect(ai.calls).toHaveLength(1);
  });

  it('returns stale content marked refreshing when the inputs change, once per target', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    ai.queue(summary(['c1']));
    await t.drain();
    await sql`update test_notes set body = 'a new plan' where id = ${noteId}`;

    const stale = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    const again = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(stale.state).toBe('refreshing');
    expect(stale.content?.output).toEqual(summary(['c1']).object);
    expect(again.state).toBe('refreshing');
    expect(t.jobs).toHaveLength(2);

    ai.queue(summary([]));
    await t.drain();
    const fresh = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(fresh.state).toBe('ready');
    expect(fresh.content?.output).toEqual(summary([]).object);
  });

  it('turns invented citations into unsourced claims', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    ai.queue(summary(['c1', 'c9']));
    await t.insights.regenerate('issue_summary', noteId);
    const insight = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(insight.content?.output).toEqual(summary(['c1']).object);
    expect(insight.content?.citations.map((c) => c.id)).toEqual(['c1']);
  });

  it('sends no body text to the model with share content off', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    ai.setPolicy({ shareContent: false });
    ai.queue(summary(['c1']));
    await t.insights.regenerate('issue_summary', noteId);
    const sent = JSON.stringify(ai.calls);
    expect(sent).toContain('Session storage');
    expect(sent).not.toContain(SECRET);
    const insight = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(insight.content?.source.titlesOnly).toBe(true);
  });

  it('refuses with AI off, for an opted-out person, a role without AI assist, an excluded project and a hidden target', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const reason = async (promise: Promise<unknown>) => {
      const error = await promise.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ForbiddenError);
      return (error as ForbiddenError).details;
    };
    ai.setPolicy({ enabled: false });
    expect(await reason(t.insights.get(ctxFor(userId), 'issue_summary', noteId))).toEqual({
      reason: 'ai_off',
    });
    ai.setPolicy({ enabled: true, actorOptedOut: true });
    expect(await reason(t.insights.get(ctxFor(userId), 'issue_summary', noteId))).toEqual({
      reason: 'opted_out',
    });
    ai.setPolicy({ actorOptedOut: false });
    await expect(
      t.insights.get(ctxFor(userId, false), 'issue_summary', noteId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    ai.setPolicy({ excludedProjectIds: [projectId] });
    expect(await reason(t.insights.get(ctxFor(userId), 'issue_summary', noteId))).toEqual({
      reason: 'excluded',
    });
    await expect(
      t.insights.get(ctxFor(userId), 'issue_summary', '00000000-0000-7000-8000-00000000dead'),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(t.insights.get(ctxFor(userId), 'page_tldr', noteId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(t.jobs).toHaveLength(0);
    expect(ai.calls).toHaveLength(0);
  });

  it('stores a provider failure as failed with honest copy, and Try again regenerates', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    ai.queue({ error: new Error('upstream exploded') });
    await t.insights.regenerate('issue_summary', noteId);
    const failed = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    expect(failed.state).toBe('failed');
    expect(failed.error).toEqual(expect.any(String));
    // Viewing a failed card again neither queues another call nor hides the failure.
    expect((await t.insights.get(ctxFor(userId), 'issue_summary', noteId)).state).toBe('failed');
    expect(t.jobs).toHaveLength(0);

    const retry = await t.insights.refresh(ctxFor(userId), 'issue_summary', noteId);
    expect(retry.state).toBe('pending');
    ai.queue(summary(['c1']));
    await t.drain();
    expect((await t.insights.get(ctxFor(userId), 'issue_summary', noteId)).state).toBe('ready');
  });

  it('records "Not useful" on the insight and on the ai_runs row behind it', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    const runId = '00000000-0000-7000-8000-000000000001';
    await sql`insert into ai_runs (id, role, purpose, input_hash, outcome)
      values (${runId}, 'standard', 'summary', 'x', 'ok') on conflict do nothing`;
    ai.queue(summary(['c1']));
    await t.insights.regenerate('issue_summary', noteId);
    const insight = await t.insights.get(ctxFor(userId), 'issue_summary', noteId);
    await t.insights.feedback(ctxFor(userId), insight.id!, 'not_useful');
    const [row] = await sql<{ feedback: string; run_feedback: string }[]>`
      select i.feedback, r.feedback as run_feedback
      from ai_insights i join ai_runs r on r.id = i.run_id where i.id = ${insight.id}`;
    expect(row).toEqual({ feedback: 'not_useful', run_feedback: 'not_useful' });
    expect((await t.insights.get(ctxFor(userId), 'issue_summary', noteId)).feedback).toBe(
      'not_useful',
    );
  });

  it('waits out a quiet period before regenerating on a request event', async (ctx) => {
    if (!sql) return ctx.skip(server.available ? 'no database' : server.reason);
    await t.events.publish({
      kind: 'ai.insight.requested',
      occurredAt: new Date(),
      payload: { kind: 'issue_summary', targetIds: [noteId], quietSeconds: 300 },
    });
    await t.events.publish({
      kind: 'ai.insight.requested',
      occurredAt: new Date(),
      payload: { kind: 'issue_summary', targetIds: [noteId], quietSeconds: 300 },
    });
    expect(t.jobs).toHaveLength(1);
    expect(t.jobs[0]!.options).toMatchObject({
      key: `issue_summary:${noteId}:quiet`,
      singleton: true,
      startAfter: 300,
    });
    ai.queue(summary(['c1']));
    await t.drain();
    expect(ai.calls).toHaveLength(1);
  });
});
