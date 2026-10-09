import { NOTIFICATION_EVENT_KINDS, type NotificationRequestedPayload } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

const said = (value: string, mentions: readonly string[] = []): RichText => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: value },
        ...mentions.map((id) => ({ type: 'mention', attrs: { id } })),
      ],
    },
  ],
});

describe('mentions in an issue description against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('NAMED', [work.users.member]);
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  const mentions = () =>
    work.events
      .filter((event) => event.kind === NOTIFICATION_EVENT_KINDS.notificationRequested)
      .map((event) => event.payload as NotificationRequestedPayload)
      .filter((notice) => notice.kind === 'mention');

  it('tells the people a new description names, and only those who may open it', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const before = mentions().length;
    const issue = await work.issue(project, 'Rotate keys', {
      description: said('Ask ', [work.users.member, work.users.outsider]),
    });
    const sent = mentions().slice(before);
    expect(sent.map((notice) => notice.recipientIds)).toEqual([[work.users.member]]);
    expect(sent[0]?.target).toMatchObject({ kind: 'issue', label: issue.key });
  });

  it('tells someone once when an edit first names them, not on every later edit', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const admin = work.as(work.users.admin);
    const issue = await work.issue(project, 'Audit exports', { description: said('Plain') });
    const before = mentions().length;
    await work.services.issues.update(admin, issue.key, {
      description: said('Over to ', [work.users.member]),
    });
    await work.services.issues.update(admin, issue.key, {
      description: said('Over to you, ', [work.users.member]),
    });
    await work.services.issues.update(admin, issue.key, { title: 'Audit the exports' });
    expect(
      mentions()
        .slice(before)
        .map((notice) => notice.recipientIds),
    ).toEqual([[work.users.member]]);
  });
});
