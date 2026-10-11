import {
  NOTIFICATION_EVENT_KINDS,
  ForbiddenError,
  ValidationError,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { RichText } from '../../../../shared/common.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

const text = (value: string, mentions: readonly string[] = []): RichText => ({
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

describe('comments against Postgres', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let issue: Issue;

  beforeAll(async () => {
    start = await startWorkHarness();
    if (!start.available) return;
    work = start.harness;
    project = await work.project('TALK', [work.users.member]);
    issue = await work.issue(project, 'Discuss the rollout');
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  const notices = () =>
    work.events
      .filter((event) => event.kind === NOTIFICATION_EVENT_KINDS.notificationRequested)
      .map((event) => event.payload as NotificationRequestedPayload);

  it('threads replies under a comment and keeps them on their own issue', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const member = work.as(work.users.member);
    const root = await work.services.comments.create(member, issue.key, {
      body: text('Should we ship behind a flag?'),
    });
    const reply = await work.services.comments.create(work.as(work.users.admin), issue.key, {
      body: text('Yes, default off.'),
      parentId: root.id,
    });
    expect(reply.parentId).toBe(root.id);
    const other = await work.issue(project, 'Elsewhere');
    await expect(
      work.services.comments.create(member, other.key, {
        body: text('Wrong thread'),
        parentId: root.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    const page = await work.services.comments.list(member, issue.key, { limit: 50 });
    expect(page.items.map((comment) => [comment.bodyText.trim(), comment.parentId])).toEqual([
      ['Should we ship behind a flag?', null],
      ['Yes, default off.', root.id],
    ]);
    await expect(
      work.services.comments.list(work.as(work.users.outsider), issue.key, { limit: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('keeps every concurrent reaction and toggles only the reactor’s own', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const comment = await work.services.comments.create(work.as(work.users.member), issue.key, {
      body: text('React to me'),
    });
    await Promise.all(
      [work.users.admin, work.users.member].map((userId) =>
        work.services.comments.react(work.as(userId), comment.id, { reaction: '+1' }),
      ),
    );
    await work.services.comments.react(work.as(work.users.member), comment.id, {
      reaction: 'eyes',
    });
    const off = await work.services.comments.react(work.as(work.users.member), comment.id, {
      reaction: '+1',
      on: false,
    });
    expect(off.reactions).toEqual({ '+1': [work.users.admin], eyes: [work.users.member] });
    const gone = await work.services.comments.react(work.as(work.users.member), comment.id, {
      reaction: 'eyes',
      on: false,
    });
    expect(gone.reactions).toEqual({ '+1': [work.users.admin] });
  });

  it('lets only the author edit, and hides a deleted comment', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const comment = await work.services.comments.create(work.as(work.users.member), issue.key, {
      body: text('Typo hree'),
    });
    await expect(
      work.services.comments.update(work.as(work.users.admin), comment.id, { body: text('x') }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const edited = await work.services.comments.update(work.as(work.users.member), comment.id, {
      body: text('Typo here'),
    });
    expect(edited.editedAt).not.toBeNull();
    await work.services.comments.remove(work.as(work.users.member), comment.id);
    const page = await work.services.comments.list(work.as(work.users.member), issue.key, {
      limit: 50,
    });
    expect(page.items.map((item) => item.id)).not.toContain(comment.id);
  });

  it('tells watchers and the people mentioned, but nobody who cannot open the issue', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const before = notices().length;
    await work.services.comments.create(work.as(work.users.member), issue.key, {
      body: text('Over to you ', [work.users.admin, work.users.outsider]),
    });
    const sent = notices().slice(before);
    expect(sent.map((notice) => [notice.kind, notice.recipientIds])).toEqual([
      ['mention', [work.users.admin]],
    ]);
    expect(sent[0]?.target).toMatchObject({ kind: 'issue', label: issue.key });
  });
});
