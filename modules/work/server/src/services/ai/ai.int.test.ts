import { emptyContributions, type AiPolicy, type ModuleContext } from '@bemmoly/core';
import { createTestAi, createTestInsights } from '@bemmoly/core/testing';
import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { createIssueContextBuilder, ISSUE_CONTEXT_LIMITS, registerWorkAi } from './index.ts';
import { createSprintContextBuilder } from './sprint-context.ts';
import { createWorkActivitySource } from './activity.ts';

const SECRET = 'Dual-write sessions then cut reads behind auth_pg_sessions';
const COMMENT = 'Backfill verified on staging with zero mismatches';
const doc = (text: string) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

let harness: WorkHarness | undefined;
let skipReason = '';
const fixture = { projectId: '', issueId: '', issueKey: '', blockerKey: '', sprintId: '' };

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
  availableRoles: ['fast', 'standard', 'strong', 'embedding'],
  assignedRoles: ['fast', 'standard', 'strong', 'embedding'],
  ...change,
});

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipReason = started.reason;
    return;
  }
  harness = started.harness;
  const { services, as, users } = harness;
  const project = await harness.project('PLT', [users.member]);
  const sprint = await services.sprints.create(as(users.admin), project.id, { name: 'Sprint 14' });
  await services.sprints.start(as(users.admin), sprint.id, {});
  const issue = await harness.issue(project, 'Move sessions to Postgres', {
    description: doc(SECRET),
    estimate: 5,
    sprintId: sprint.id,
    assigneeId: users.member,
  });
  const blocker = await harness.issue(project, 'Review PR 4821', {
    estimate: 3,
    sprintId: sprint.id,
  });
  await services.links.create(as(users.admin), issue.key, {
    targetId: blocker.id,
    kind: 'blocks',
    inverse: true,
  });
  for (let n = 1; n <= 14; n += 1) {
    await services.comments.create(as(users.member), issue.key, {
      body: doc(n === 14 ? COMMENT : `Note ${n}`),
    });
  }
  Object.assign(fixture, {
    projectId: project.id,
    issueId: issue.id,
    issueKey: issue.key,
    blockerKey: blocker.key,
    sprintId: sprint.id,
  });
});

afterAll(async () => {
  await harness?.stop();
});

const options = (change: Partial<AiPolicy> = {}) => ({
  policy: policy(change),
  now: new Date(),
  since: null,
});

describe('issueContext', () => {
  it('cites the issue, its blockers, its latest comments and its history, bounded', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const builder = createIssueContextBuilder(() => harness!.sql);
    const context = (await builder.build(fixture.issueId, options()))!;
    expect(context.text).toContain(`[c1] ${fixture.issueKey} · Move sessions to Postgres`);
    expect(context.text).toContain(SECRET);
    expect(context.text).toContain(`blocked by ${fixture.blockerKey}`);
    expect(context.text).toContain(`Comments (latest ${ISSUE_CONTEXT_LIMITS.comments} of 14)`);
    expect(context.text).toContain(COMMENT);
    expect(context.text).not.toContain('Note 1\n');
    expect(context.source.counts.comments).toBe(ISSUE_CONTEXT_LIMITS.comments);
    expect(context.citations[0]).toMatchObject({
      id: 'c1',
      kind: 'issue',
      objectId: fixture.issueId,
      href: `/work/issue/${fixture.issueKey}`,
    });
    expect(context.text.length).toBeLessThanOrEqual(ISSUE_CONTEXT_LIMITS.chars);
    expect(context.audience).toEqual({ projectId: fixture.projectId });
  });

  it('lets no description or comment text escape with share content off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const builder = createIssueContextBuilder(() => harness!.sql);
    const context = (await builder.build(fixture.issueId, options({ shareContent: false })))!;
    expect(context.text).not.toContain(SECRET);
    expect(context.text).not.toContain(COMMENT);
    expect(context.text).not.toContain('Note 3');
    expect(context.text).toContain('Move sessions to Postgres');
    expect(context.text).toContain('status');
    expect(context.source.titlesOnly).toBe(true);
  });

  it("keeps an opted-out author's comments home, refuses an excluded project and hides from outsiders", async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const builder = createIssueContextBuilder(() => harness!.sql);
    const optedOut = (await builder.build(
      fixture.issueId,
      options({ optedOutUserIds: [harness.users.member] }),
    ))!;
    expect(optedOut.text).toContain(SECRET);
    expect(optedOut.text).not.toContain(COMMENT);
    await expect(
      builder.build(fixture.issueId, options({ excludedProjectIds: [fixture.projectId] })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await builder.canView(harness.as(harness.users.member), fixture.issueId)).toBe(true);
    expect(await builder.canView(harness.as(harness.users.outsider), fixture.issueId)).toBe(false);
  });
});

describe('sprintContext', () => {
  it('gives points done against committed, ages, blockers and review waits', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const builder = createSprintContextBuilder(() => harness!.sql);
    const context = (await builder.build(fixture.sprintId, options()))!;
    expect(context.text).toContain('Sprint 14 (active)');
    expect(context.text).toContain('0 of 8 points done');
    expect(context.text).toContain(`blocked by ${fixture.blockerKey}`);
    expect(context.text).toMatch(/for 0 days/);
    expect(context.source.counts.issues).toBe(2);
    expect(await builder.lastChangedAt!(fixture.sprintId)).toBeInstanceOf(Date);
  });
});

describe('Work activity for the morning brief', () => {
  it("covers changes in the person's projects and nothing from others", async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const { createContextWriter } = await import('@bemmoly/core');
    const source = createWorkActivitySource(() => harness!.sql);
    const since = new Date(Date.now() - 86_400_000);
    const member = createContextWriter({ policy: policy() });
    await source.collect(member, {
      userId: harness.users.member,
      since,
      now: new Date(),
      policy: policy(),
    });
    const text = member.build().text;
    expect(text).toContain(`${fixture.issueKey} · Move sessions to Postgres`);
    expect(text).toContain('yours');
    expect(text).toContain('Sprint 14 · 0 of 8 points done');
    const outsider = createContextWriter({ policy: policy() });
    await source.collect(outsider, {
      userId: harness.users.outsider,
      since,
      now: new Date(),
      policy: policy(),
    });
    expect(outsider.build().citations).toEqual([]);
  });
});

describe('the issue summary end to end', () => {
  it('registers through ctx.ai and answers from the cache once generated', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const contributions = emptyContributions();
    const prompts: string[] = [];
    const ai = {
      addContextBuilder: (entry: never) => contributions.aiContextBuilders.push(entry),
      addInsightGenerator: (entry: never) => contributions.aiInsightGenerators.push(entry),
      addPromptFile: (file: { name: string }) => prompts.push(file.name),
      addExclusionSource: () => undefined,
    } as unknown as ModuleContext['ai'];
    registerWorkAi({ ai }, harness.sql);
    expect(prompts).toEqual(['work.issue_summary', 'work.sprint_pulse']);

    const testAi = createTestAi();
    testAi.addPrompt('work.issue_summary', {
      role: 'standard',
      system: 'Summarise.',
      prompt: 'Summarise {{key}}: {{title}}\n{{context}}',
      outputSchema: 'issue_summary',
    });
    testAi.queue({
      object: {
        points: [{ text: 'Waiting on review of PR 4821.', cites: ['c1', 'c2'] }],
        next: [{ label: `Open ${fixture.blockerKey}`, cite: 'c2' }],
      },
    });
    const t = createTestInsights({
      ai: testAi,
      database: harness.sql,
      modules: [{ id: 'work', contributions }],
    });
    const member = harness.as(harness.users.member);
    expect((await t.insights.get(member, 'issue_summary', fixture.issueId)).state).toBe('pending');
    await t.drain();
    const ready = await t.insights.get(member, 'issue_summary', fixture.issueId);
    expect(ready.state).toBe('ready');
    expect(ready.content?.citations.map((c) => c.label)).toEqual([
      fixture.issueKey,
      fixture.blockerKey,
    ]);
    expect(JSON.stringify(testAi.calls[0])).toContain(`Summarise ${fixture.issueKey}`);
    await expect(
      t.insights.get(harness.as(harness.users.outsider), 'issue_summary', fixture.issueId),
    ).rejects.toThrow();
  });
});
