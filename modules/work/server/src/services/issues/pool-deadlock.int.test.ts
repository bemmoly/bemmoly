import type { PoolEvent } from '@bemmoly/core';
import {
  NOTIFICATION_EVENT_KINDS,
  UnavailableError,
  type NotificationRequestedPayload,
} from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RichText } from '../../../../shared/common.ts';
import type { Project } from '../../../../shared/projects.ts';
import { startWorkHarness, type HarnessStart, type WorkHarness } from '../int-support.ts';

/*
 * The load test that hung a real install, shrunk to a pool of two. Each status change or
 * comment by a member holds a pool connection for its transaction; when anything inside it
 * asked the pool for a second one (the member's own authorization, the recipients' access
 * check), two of them at once held both connections and waited on each other forever. The
 * pool reports nested acquires here instead of refusing them, so the test sees the deadlock
 * itself: without the fix the waits end on the acquire timeout and the requests fail.
 */

const POOL_SIZE = 2;
const ACQUIRE_TIMEOUT_MS = 4_000;

const text = (value: string): RichText => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

/** The UnavailableError behind an error, however the ORM wrapped it. */
function unavailableIn(error: unknown): UnavailableError | undefined {
  for (let current = error; current; current = (current as { cause?: unknown }).cause) {
    if (current instanceof UnavailableError) return current;
  }
  return undefined;
}

describe('a pool of two under concurrent member writes', () => {
  let start: HarnessStart;
  let work: WorkHarness;
  let project: Project;
  let selected: string;
  const poolEvents: PoolEvent[] = [];

  beforeAll(async () => {
    start = await startWorkHarness({
      maxConnections: POOL_SIZE,
      acquireTimeoutMs: ACQUIRE_TIMEOUT_MS,
      nestedAcquire: 'warn',
      onPoolEvent: (event) => poolEvents.push(event),
    });
    if (!start.available) return;
    work = start.harness;
    project = await work.project('POOL', [work.users.member, work.users.outsider]);
    const [status] = await work.sql<{ id: string }[]>`
      select id from workflow_statuses where name = 'Selected'`;
    selected = status?.id ?? '';
    poolEvents.length = 0;
  });

  afterAll(async () => {
    if (start.available) await work.stop();
  });

  it('moves three issues at once for a member without starving the pool', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issues = await Promise.all(
      ['One', 'Two', 'Three'].map((title) => work.issue(project, `Move ${title}`)),
    );
    poolEvents.length = 0;
    const member = work.as(work.users.member);
    const moved = await Promise.allSettled(
      issues.map((issue) => work.services.issues.update(member, issue.key, { statusId: selected })),
    );
    expect(moved.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(poolEvents).toEqual([]);
  });

  it('takes three comments at once on a watched issue and tells the watchers', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'Talk about it');
    for (const userId of [work.users.member, work.users.outsider]) {
      await work.sql`
        insert into watchers (target_kind, target_id, user_id)
        values ('issue', ${issue.id}, ${userId}) on conflict do nothing`;
    }
    poolEvents.length = 0;
    work.events.length = 0;
    const member = work.as(work.users.member);
    const posted = await Promise.allSettled(
      ['first', 'second', 'third'].map((word) =>
        work.services.comments.create(member, issue.key, { body: text(`The ${word} take`) }),
      ),
    );
    expect(posted.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(poolEvents).toEqual([]);
    const told = work.events
      .filter((event) => event.kind === NOTIFICATION_EVENT_KINDS.notificationRequested)
      .map((event) => [...(event.payload as NotificationRequestedPayload).recipientIds].sort());
    // The reporter watches too; the commenter is never told of their own comment.
    const watchers = [work.users.admin, work.users.outsider].sort();
    expect(told).toEqual([watchers, watchers, watchers]);
  });

  it('fails a starved read as unavailable, then serves it once the pool frees', async (ctx) => {
    if (!start.available) return ctx.skip(start.reason);
    const issue = await work.issue(project, 'Wait for a connection');
    poolEvents.length = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const holders = Array.from({ length: POOL_SIZE }, () =>
      work.sql.begin(async (tx) => {
        await tx`select 1`;
        await held;
      }),
    );
    // Both connections are taken: the read waits, then fails as unavailable.
    const member = work.as(work.users.member);
    const starved = await work.services.issues.get(member, issue.key).catch((error) => error);
    expect(unavailableIn(starved)?.code).toBe('unavailable');
    expect(poolEvents.map((event) => event.kind)).toContain('acquire_timeout');
    release();
    await Promise.all(holders);
    await expect(work.services.issues.get(member, issue.key)).resolves.toMatchObject({
      key: issue.key,
    });
  });
});
