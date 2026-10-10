import {
  createLocalEventBus,
  defineContextBuilder,
  emptyContributions,
  type AiPolicy,
  type EntitySummary,
  type ModuleContext,
} from '@bemmoly/core';
import { createTestAi, createTestInsights, type TestInsights } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { createPageContextBuilder, registerDocsAi, tldrSourceHash } from './index.ts';

const ISSUE_ID = '00000000-0000-7000-8000-000000000204';
const BODY = 'Sessions keep a flag TTL of 15 minutes while PLT-204 rolls out.';
const COMMENT = 'Should the TTL match the issue?';
const PLT_204: EntitySummary = {
  kind: 'issue',
  id: ISSUE_ID,
  key: 'PLT-204',
  title: 'Move sessions to Postgres',
  path: '/work/issue/PLT-204',
  data: { projectId: '00000000-0000-7000-8000-0000000000aa', status: { name: 'In review' } },
};
const snapshot = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Why we move sessions.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollback' }] },
    { type: 'paragraph', content: [{ type: 'text', text: BODY }] },
  ],
};

let harness: DocsHarness | undefined;
let skipReason = '';
let pageId = '';
let spaceId = '';
const events = createLocalEventBus();
const ai = createTestAi();
let t: TestInsights;

const policy = (change: Partial<AiPolicy> = {}) => ({
  policy: { ...OPTIONS_POLICY, ...change },
  now: new Date(),
  since: null,
});
let OPTIONS_POLICY: AiPolicy;

beforeAll(async () => {
  OPTIONS_POLICY = await ai.policy(null);
  const entities = {
    resolve: async () => PLT_204,
    resolveMany: async () => [PLT_204],
    has: () => true,
  };
  const started = await startDocsHarness({ entities, events, ai });
  if (!started.available) {
    skipReason = started.reason;
    return;
  }
  harness = started.harness;
  const { services, as, users, sql } = harness;
  const space = await harness.space('ENG');
  spaceId = space.id;
  const page = await services.pages.create(as(users.member), {
    spaceId,
    title: 'Auth service RFC',
  });
  pageId = page.id;
  await sql`update pages set snapshot = ${JSON.stringify(snapshot)}::jsonb,
    text = ${`Why we move sessions.\nRollback\n${BODY}`} where id = ${pageId}`;
  await sql`insert into links (source_kind, source_id, target_kind, target_id, kind)
    values ('page', ${pageId}, 'issue', ${ISSUE_ID}, 'embed')`;
  await sql`insert into page_comments (page_id, author_id, body, body_text)
    values (${pageId}, ${users.admin}, '{"type":"doc"}'::jsonb, ${COMMENT})`;

  const contributions = emptyContributions();
  const ctxAi = {
    addContextBuilder: (entry: never) => contributions.aiContextBuilders.push(entry),
    addInsightGenerator: (entry: never) => contributions.aiInsightGenerators.push(entry),
    addPromptFile: () => undefined,
  } as unknown as ModuleContext['ai'];
  registerDocsAi({ ai: ctxAi, events }, { database: sql, entities });
  const work = emptyContributions();
  work.aiContextBuilders.push(
    defineContextBuilder('work.issue_details', 'Issue details', {
      type: 'related',
      targetKinds: ['issue'],
      async collect(writer, target) {
        writer.cite({
          kind: 'issue',
          objectId: target.id,
          label: 'PLT-204',
          line: 'PLT-204 · Move sessions to Postgres · status In review',
          body: 'Keep the flag TTL at 30 minutes until reads cut over.',
          counts: 'issues',
        });
      },
    }),
  );
  ai.addPrompt('docs.tldr', {
    role: 'standard',
    system: 'TL;DR.',
    prompt: '{{title}}\n{{context}}',
    outputSchema: 'page_tldr',
  });
  ai.addPrompt('docs.consistency', {
    role: 'standard',
    system: 'Check.',
    prompt: '{{title}}\n{{context}}',
    outputSchema: 'consistency',
  });
  t = createTestInsights({
    ai,
    database: sql,
    events,
    modules: [
      { id: 'docs', contributions },
      { id: 'work', contributions: work },
    ],
  });
});

afterAll(async () => {
  await harness?.stop();
});

describe('pageContext', () => {
  it('cites the page by heading, its issues, open comments, and lets no body out with sharing off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const builder = createPageContextBuilder({
      database: harness.sql,
      entities: { resolve: async () => PLT_204, resolveMany: async () => [PLT_204] },
    });
    const context = (await builder.build(pageId, policy()))!;
    expect(context.text).toContain('Section "Rollback"');
    expect(context.text).toContain(BODY);
    expect(context.text).toContain('PLT-204 · Move sessions to Postgres · In review');
    expect(context.text).toContain(COMMENT);
    expect(context.citations.find((c) => c.location === 'Rollback')?.href).toBe(
      `/docs/p/${pageId}#rollback`,
    );
    expect(context.audience).toEqual({ spaceId });

    const off = (await builder.build(pageId, policy({ shareContent: false })))!;
    expect(off.text).not.toContain(BODY);
    expect(off.text).not.toContain(COMMENT);
    expect(off.text).not.toContain('Why we move sessions');
    expect(off.text).toContain('Auth service RFC');
    await expect(builder.build(pageId, policy({ excludedSpaceIds: [spaceId] }))).rejects.toThrow();
  });
});

describe('the page TL;DR', () => {
  it('regenerates only when the text changes and copies itself onto the page', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const member = harness.as(harness.users.member);
    expect((await t.insights.get(member, 'page_tldr', pageId)).state).toBe('pending');
    ai.queue({
      object: { points: [{ text: 'Sessions move to Postgres behind a flag.', cites: ['c2'] }] },
    });
    await t.drain();
    const ready = await t.insights.get(member, 'page_tldr', pageId);
    expect(ready.state).toBe('ready');
    const [row] = await harness.sql<{ tldr: string; tldr_source_hash: string; text: string }[]>`
      select tldr, tldr_source_hash, text from pages where id = ${pageId}`;
    expect(row!.tldr).toBe('Sessions move to Postgres behind a flag.');
    expect(row!.tldr_source_hash).toBe(tldrSourceHash(row!.text));

    await harness.sql`insert into page_comments (page_id, author_id, body, body_text)
      values (${pageId}, ${harness.users.admin}, '{"type":"doc"}'::jsonb, 'A new comment')`;
    expect((await t.insights.get(member, 'page_tldr', pageId)).state).toBe('ready');
    await harness.sql`update pages set text = text || ' More.' where id = ${pageId}`;
    expect((await t.insights.get(member, 'page_tldr', pageId)).state).toBe('refreshing');
    expect(
      await t.insights
        .get(harness.as(harness.users.outsider), 'page_tldr', pageId)
        .catch(() => 'refused'),
    ).toBe('refused');
  });
});

describe('consistency checks', () => {
  it('run on publish, pair each issue with its paragraph and feed Needs attention', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    ai.queue({ object: { points: [{ text: 'Sessions move behind a flag.', cites: ['c2'] }] } });
    await t.drain();
    const before = t.jobs.length;
    ai.queue({
      object: {
        findings: [
          {
            claim: 'The flag TTL is 15 minutes.',
            location: { heading: 'Rollback', paragraph: 1 },
            issueKey: 'PLT-204',
            field: 'description',
            issueValue: '30 minutes',
            confidence: 0.92,
            cites: ['c1', 'c2'],
          },
        ],
      },
    });
    await harness.services.status.setStatus(harness.as(harness.users.member), pageId, {
      status: 'published',
    });
    expect(t.jobs.length).toBe(before + 1);
    await t.drain();
    const sent = JSON.stringify(ai.calls.at(-1));
    expect(sent).toContain('30 minutes');
    expect(sent).toContain('paragraph 1');
    const insight = await t.insights.get(harness.as(harness.users.member), 'consistency', pageId);
    expect(insight.kind === 'consistency' && insight.content?.output.findings[0]?.issueKey).toBe(
      'PLT-204',
    );

    const attention = await harness.services.home.attention(harness.as(harness.users.member), {
      limit: 10,
    });
    expect(attention.items).toContainEqual(
      expect.objectContaining({ kind: 'consistency', findings: 1 }),
    );
    ai.setPolicy({ enabled: false });
    const off = await harness.services.home.attention(harness.as(harness.users.member), {
      limit: 10,
    });
    expect(off.items.some((item) => item.kind === 'consistency')).toBe(false);
    ai.setPolicy({ enabled: true });
  });

  it('re-check the published pages that name an issue when it changes', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const before = t.jobs.length;
    await events.publish({
      kind: 'ai.source.changed',
      occurredAt: new Date(),
      payload: { kind: 'issue', ids: [ISSUE_ID] },
    });
    expect(t.jobs.slice(before).map((job) => job.payload)).toEqual([
      { kind: 'consistency', targetId: pageId, quietSeconds: 60 },
    ]);
  });
});
