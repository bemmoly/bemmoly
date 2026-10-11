import { createRetrievalService, type RetrievalService } from '@bemmoly/core';
import { createTestAi, type TestAi } from '@bemmoly/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { Issue } from '../../../../shared/issues.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';
import { createIssueRetrievalSource } from './index.ts';

const said = (value: string): RichText => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

describe('Work issues as a retrieval source against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let ai: TestAi;
  let retrieval: RetrievalService;
  let migration: Issue;
  let secret: Issue;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    const open = await work.project('RET', [work.users.member]);
    const closed = await work.project('SEC');
    migration = await work.issue(open, 'Session store migration', {
      description: said('Dual-write sessions, then switch reads behind auth_pg_sessions.'),
    });
    await work.services.comments.create(work.as(work.users.member), migration.key, {
      body: said('Rollback is a flag flip; Redis stays warm for 7 days.'),
    });
    secret = await work.issue(closed, 'Rotate the payroll keys', {
      description: said('Rollback the payroll keys from the vault.'),
    });
    ai = createTestAi();
    retrieval = createRetrievalService({
      sql: work.sql,
      ai: () => ai,
      sources: () => [{ ...createIssueRetrievalSource(work.sql), moduleId: 'work' }],
      keyword: () => [],
      isEnabled: () => true,
    });
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('reads an issue as its description plus one chunk per comment', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const [issue] = await createIssueRetrievalSource(work.sql).load([migration.id]);
    expect(issue).toMatchObject({
      title: `${migration.key} Session store migration`,
      path: `/work/issue/${migration.key}`,
    });
    expect(issue?.chunks.map((chunk) => [chunk.location.part, chunk.authorId])).toEqual([
      ['description', work.users.admin],
      ['comment', work.users.member],
    ]);
  });

  it('keeps to the projects a person is in', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const source = createIssueRetrievalSource(work.sql);
    const ids = [migration.id, secret.id];
    expect(await source.visible(work.as(work.users.member), ids)).toEqual(new Set([migration.id]));
    expect(await source.visible(work.as(work.users.admin), ids)).toEqual(new Set(ids));
    expect(await source.visible(work.as(work.users.outsider), ids)).toEqual(new Set());
    expect(await source.list({ after: null, limit: 10 })).toEqual([migration.id, secret.id].sort());
  });

  it('never hands a member an issue from a project they are not in', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    await retrieval.indexRecords('work.issue', [migration.id, secret.id]);
    const question = 'rollback keys flag';
    const member = await retrieval.retrieve(work.as(work.users.member), { question });
    expect(member.sources.map((source) => source.targetId)).not.toContain(secret.id);
    const outsider = await retrieval.retrieve(work.as(work.users.outsider), { question });
    expect(outsider.chunks).toEqual([]);
  });
});
