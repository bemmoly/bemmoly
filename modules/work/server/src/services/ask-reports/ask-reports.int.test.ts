import { createTestAi } from '@bemmoly/core/testing';
import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReportSpec } from '../../../../shared/ask-reports.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { ASK_REPORT_PROMPT, createAskReportsServices, type AskReportsServices } from './index.ts';

/*
 * Asked and pinned reports on real Postgres: the spec the (mock) model returns runs against
 * the project's issues with the asker's permissions, and a pin re-runs live on every read.
 */

let harness: WorkHarness | undefined;
let services: AskReportsServices;
let skipReason = '';
const ai = createTestAi();
const fixture = { key: '', projectId: '', project: undefined as Project | undefined };

const BY_PERSON: ReportSpec = {
  title: 'Open issues by person',
  metric: 'open_issues',
  groupBy: 'assignee',
  filters: {},
  chart: 'bar',
};

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipReason = started.reason;
    return;
  }
  harness = started.harness;
  const { users } = harness;
  ai.addPrompt(ASK_REPORT_PROMPT, {
    role: 'standard',
    system: 'Spec.',
    prompt: '{{project}} {{statuses}} {{types}} {{today}} {{question}}',
    outputSchema: ASK_REPORT_PROMPT,
  });
  services = createAskReportsServices({ database: harness.sql, ai });
  const project = await harness.project('ASK', [users.member]);
  await harness.issue(project, 'Fix login', { assigneeId: users.member, estimate: 3 });
  await harness.issue(project, 'Fix logout', { assigneeId: users.member, estimate: 2 });
  await harness.issue(project, 'Write docs');
  Object.assign(fixture, { key: project.key, projectId: project.id, project });
});

afterAll(async () => {
  await harness?.stop();
});

describe('asked reports', () => {
  it('runs the spec the model chose against the project', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    ai.queue({ object: BY_PERSON });
    const response = await services.ask.ask(harness.as(harness.users.member), fixture.key, {
      question: 'How loaded is each person?',
    });
    expect(response.result.total).toBe(3);
    expect(response.result.rows.map((row) => [row.label, row.value])).toEqual([
      ['mo', 2],
      ['Unassigned', 1],
    ]);
  });

  it('refuses someone who cannot read the project, before any model call', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const before = ai.calls.length;
    await expect(
      services.ask.ask(harness.as(harness.users.outsider), fixture.key, { question: 'Load?' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ai.calls.length).toBe(before);
  });
});

describe('pinned reports', () => {
  it('pins a spec, rebuilds it live and keeps it private to its owner', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const member = harness.as(harness.users.member);
    const pin = await services.pinned.create(member, fixture.key, {
      question: 'How loaded is each person?',
      spec: BY_PERSON,
    });
    expect(pin.spec).toEqual(BY_PERSON);

    await harness.issue(fixture.project!, 'Fix signup', { assigneeId: harness.users.member });
    const [view] = await services.pinned.list(member, fixture.key);
    expect(view?.result?.total).toBe(4);
    expect(view?.error).toBeNull();

    expect(await services.pinned.list(harness.as(harness.users.admin), fixture.key)).toEqual([]);
    await expect(
      services.pinned.remove(harness.as(harness.users.admin), pin.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    await services.pinned.remove(member, pin.id);
    expect(await services.pinned.list(member, fixture.key)).toEqual([]);
  });

  it('says so when a stored spec no longer parses, and still lists it', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await harness.sql`
      insert into pinned_reports (owner_id, project_id, question, spec)
      values (${harness.users.member}, ${fixture.projectId}, 'Old', '{"metric":"gone"}'::jsonb)`;
    const [view] = await services.pinned.list(harness.as(harness.users.member), fixture.key);
    expect(view?.result).toBeNull();
    expect(view?.error).toMatch(/no longer be built/);
  });
});
