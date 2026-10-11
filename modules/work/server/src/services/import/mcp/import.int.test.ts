import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ImportedIssue } from '../../../../../shared/issue-import.ts';
import type { Project } from '../../../../../shared/projects.ts';
import { startWorkHarness, type WorkHarness } from '../../int-support.ts';

/*
 * An agent bringing a project over from another tracker: numbers kept when free, the
 * source's times and people, comments by someone with no account, parents across the batch,
 * and the same batch sent again updating what the first one made.
 */

let h: WorkHarness | undefined;
let skipped = '';
let project: Project;

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  project = await h.project('TRP', [h.users.member]);
  await h.issue(project, 'Made here before the import');
});

afterAll(async () => {
  await h?.stop();
});

const iso = (value: Date | string | undefined) => (value ? new Date(value).toISOString() : null);

const longText = 'Packing list line. '.repeat(5_200);

function batch(title = 'Book the ferry'): ImportedIssue[] {
  return [
    {
      externalKey: 'TRP-12',
      title,
      descriptionMarkdown: `# Ferry\n\n${longText}`,
      type: 'Epic',
      status: 'Done',
      priority: 'high',
      assigneeEmail: 'mo@example.test',
      reporterEmail: 'nobody@example.test',
      labels: ['travel', 'Boats'],
      createdAt: '2023-04-01T09:00:00.000Z',
      updatedAt: '2023-05-01T09:00:00.000Z',
      resolvedAt: '2023-04-30T09:00:00.000Z',
      comments: [
        {
          authorEmail: 'mo@example.test',
          createdAt: '2023-04-02T10:00:00.000Z',
          bodyMarkdown: 'Booked **two** cabins.',
        },
        {
          authorName: 'Jane Doe',
          authorEmail: 'jane@elsewhere.test',
          createdAt: '2023-04-03T10:00:00.000Z',
          bodyMarkdown: 'Remember the bikes.',
        },
      ],
    },
    {
      externalKey: 'TRP-13',
      title: 'Pack the bikes',
      type: 'task',
      status: 'In progress',
      assigneeEmail: 'ghost@example.test',
      parentExternalKey: 'TRP-12',
    },
    { externalKey: 'TRP-1', title: 'Number already taken', type: 'Task', status: 'Backlog' },
    { externalKey: 'TRP-20', title: 'Unknown status', type: 'Task', status: 'Shipped' },
  ];
}

describe('work_import_issues', () => {
  it('imports, keeps numbers and times, and updates on a re-run', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const admin = h.as(h.users.admin);
    const first = await h.services.issueImport.run(admin, { projectKey: 'TRP', issues: batch() });
    expect(first.created.map((item) => [item.externalKey, item.key])).toEqual([
      ['TRP-12', 'TRP-12'],
      ['TRP-13', 'TRP-13'],
      ['TRP-1', 'TRP-2'],
    ]);
    expect(first.skipped).toEqual([
      { externalKey: 'TRP-20', reason: "There is no status Shipped in the project's workflow" },
    ]);
    expect(first.warnings.map((item) => item.externalKey)).toEqual(['TRP-13']);

    const [epic] = await h.sql<
      {
        id: string;
        created_at: Date;
        updated_at: Date;
        resolved_at: Date;
        assignee_id: string;
        reporter_id: string;
        description_text: string;
        priority: string;
      }[]
    >`select id, created_at, updated_at, resolved_at, assignee_id, reporter_id,
        description_text, priority
      from issues where key = 'TRP-12'`;
    expect(iso(epic?.created_at)).toBe('2023-04-01T09:00:00.000Z');
    expect(iso(epic?.updated_at)).toBe('2023-05-01T09:00:00.000Z');
    expect(iso(epic?.resolved_at)).toBe('2023-04-30T09:00:00.000Z');
    expect(epic?.assignee_id).toBe(h.users.member);
    expect(epic?.reporter_id).toBe(h.users.admin);
    expect(epic?.priority).toBe('high');
    expect(epic?.description_text.length).toBeGreaterThan(98_000);
    const [child] = await h.sql<{ parent_id: string; assignee_id: string | null }[]>`
      select parent_id, assignee_id from issues where key = 'TRP-13'`;
    expect(child).toEqual({ parent_id: epic?.id, assignee_id: null });
    const comments = await h.sql<{ author_id: string; body_text: string; created_at: Date }[]>`
      select author_id, body_text, created_at from comments
      where target_id = ${epic?.id as string} order by created_at`;
    expect(comments.map((row) => row.author_id)).toEqual([h.users.member, h.users.admin]);
    expect(comments[1]?.body_text).toContain('Originally by Jane Doe on 2023-04-03');
    expect(iso(comments[0]?.created_at)).toBe('2023-04-02T10:00:00.000Z');
    const labels = await h.sql<{ name: string }[]>`
      select l.name from issue_labels il join labels l on l.id = il.label_id
      where il.issue_id = ${epic?.id as string} order by l.name`;
    expect(labels.map((row) => row.name)).toEqual(['Boats', 'travel']);

    const again = await h.services.issueImport.run(admin, {
      projectKey: 'TRP',
      issues: batch('Book the night ferry'),
    });
    expect(again.created).toEqual([]);
    expect(again.updated.map((item) => item.key)).toEqual(['TRP-12', 'TRP-13', 'TRP-2']);
    const [count] = await h.sql<{ issues: number; comments: number }[]>`
      select (select count(*)::int from issues where project_id = ${project.id}) as issues,
        (select count(*)::int from comments where target_id = ${epic?.id as string}) as comments`;
    expect(count).toEqual({ issues: 4, comments: 2 });
    const [renamed] = await h.sql<{ title: string }[]>`
      select title from issues where key = 'TRP-12'`;
    expect(renamed?.title).toBe('Book the night ferry');

    const next = await h.issue(project, 'Made after the import');
    expect(next.key).toBe('TRP-14');
  });

  it('leaves an issue edited here since the import alone', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const admin = h.as(h.users.admin);
    await h.services.issues.update(admin, 'TRP-13', { title: 'Pack the bikes and helmets' });
    // The writer allows a second between its own write and an edit; this edit is later.
    await h.sql`
      update issues set updated_at = updated_at + interval '1 minute' where key = 'TRP-13'`;
    const result = await h.services.issueImport.run(admin, {
      projectKey: 'TRP',
      issues: batch().slice(1, 2),
    });
    expect(result.skipped.map((item) => item.externalKey)).toEqual(['TRP-13']);
    const [row] = await h.sql<{ title: string }[]>`select title from issues where key = 'TRP-13'`;
    expect(row?.title).toBe('Pack the bikes and helmets');
  });

  it('needs the import capability as well as editing the project', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    await expect(
      h.services.issueImport.run(h.as(h.users.member), { projectKey: 'TRP', issues: batch() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      h.services.issueImport.authorize(h.as(h.users.member), 'TRP'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      h.services.issueImport.run(h.as(h.users.outsider), { projectKey: 'TRP', issues: batch() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
