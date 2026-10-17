import { createMappingStore, type ImportMappingStore, type ImportRunContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JiraClient, JiraIssue } from '../../clients/jira.ts';
import { startWorkHarness, type WorkHarness } from '../int-support.ts';
import { runCsv } from './csv/run.ts';
import { writeComments } from './jira/extras.ts';
import type { RowContext } from './jira/issue-rows.ts';
import { writeIssues, type ImportedIssueRow } from './writer.ts';

/*
 * An import that dies part way and is run again: what committed before the failure is found
 * on the retry, never made a second time. The failure is injected where it hurts most, while
 * the mapping of a row just written is being recorded.
 */

let h: WorkHarness | undefined;
let skipped = '';

beforeAll(async () => {
  const started = await startWorkHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
});

afterAll(async () => {
  await h?.stop();
});

/** A mapping store that fails the `nth` write of `kind`, once. */
function failingStore(store: ImportMappingStore, kind: string, nth: number): ImportMappingStore {
  let writes = 0;
  const trip = (written: string) => {
    if (written !== kind) return;
    writes += 1;
    if (writes === nth) throw new Error('The source went away');
  };
  return {
    ...store,
    async set(k, sourceId, targetId, meta, executor) {
      trip(k);
      await store.set(k, sourceId, targetId, meta, executor);
    },
    async setMany(k, rows, executor) {
      trip(k);
      await store.setMany(k, rows, executor);
    },
  };
}

function runContext(mappings: ImportMappingStore): ImportRunContext {
  const unused = () => {
    throw new Error('Not used by this test');
  };
  return {
    jobId: crypto.randomUUID(),
    actorUserId: null,
    signal: new AbortController().signal,
    fetchFor: unused,
    mappings,
    include: { comments: true, attachments: true, agile: true, links: true, history: false },
    targets: new Map(),
    containers: { list: async () => [], done: async () => [], run: unused },
    checkpoint: { read: () => null, save: async () => undefined },
    progress: { phase: async () => undefined, advance: async () => undefined },
    report: { count: () => undefined, skip: () => undefined, warn: () => undefined },
    users: { match: async () => null },
    files: { store: unused, storeImage: unused },
  };
}

describe('an import retried after a failure', () => {
  it('makes CSV rows without keys once', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const store = createMappingStore(h.sql, { source: 'csv', site: 'RTC', jobId: null });
    const file = 'Title,Status\nPack the tent,To Do\nBuy fuel,Done\nCheck the map,To Do\n';
    const connection = { project: 'RTC', file };
    await expect(
      runCsv({ sql: h.sql }, connection, runContext(failingStore(store, 'issue', 1))),
    ).rejects.toThrow('The source went away');
    await runCsv({ sql: h.sql }, connection, runContext(store));
    await runCsv({ sql: h.sql }, connection, runContext(store));
    const titles = await h.sql<{ title: string }[]>`
      select i.title from issues i join projects p on p.id = i.project_id
      where p.key = 'RTC' order by i.number`;
    expect(titles.map((row) => row.title)).toEqual(['Pack the tent', 'Buy fuel', 'Check the map']);
  });

  it('makes Jira issues and comments once, and adopts an issue left unmapped', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const project = await h.project('RTJ');
    const orphan = await h.issue(project, 'Made by a run that died before mapping it');
    const [shape] = await h.sql<{ type_id: string; status_id: string }[]>`
      select type_id, status_id from issues where id = ${orphan.id}`;
    const row = (number: number): ImportedIssueRow => ({
      sourceId: `100${number}`,
      label: `RTJ-${number}`,
      number,
      key: `RTJ-${number}`,
      typeId: shape!.type_id,
      title: `Jira issue ${number}`,
      description: null,
      descriptionText: '',
      statusId: shape!.status_id,
      category: 'todo',
      priority: 'medium',
      assigneeId: null,
      reporterId: null,
      sprintId: null,
      estimate: null,
      dueAt: null,
      fixVersionId: null,
      componentId: null,
      customFields: {},
      createdAt: null,
      resolvedAt: null,
      meta: {},
    });
    const store = createMappingStore(h.sql, { source: 'jira', site: 'rtj', jobId: null });
    const report = runContext(store).report;
    const rows = [row(1), row(2)];
    await expect(
      writeIssues(h.sql, project.id, rows, failingStore(store, 'issue', 1), report, {
        adopt: true,
      }),
    ).rejects.toThrow('The source went away');
    const written = await writeIssues(h.sql, project.id, rows, store, report, { adopt: true });
    expect(written.map((item) => [item.id === orphan.id, item.created])).toEqual([
      [true, false],
      [false, true],
    ]);

    const issue = {
      id: '1002',
      key: 'SRC-2',
      fields: {
        comment: {
          comments: [
            { id: 'c1', body: 'First thought' },
            { id: 'c2', body: 'Second thought' },
          ],
          total: 2,
        },
      },
    } as unknown as JiraIssue;
    const target = written[1]!.id;
    const pages = new Map([[issue.id, { issue, id: target }]]);
    const rowContext = (mappings: ImportMappingStore) =>
      ({
        ctx: runContext(mappings),
        people: new Map(),
        cloud: false,
        siteUrl: '',
        projectKeys: new Map(),
      }) as unknown as RowContext;
    const client = {} as JiraClient;
    await expect(
      writeComments(h.sql, client, rowContext(failingStore(store, 'comment', 2)), pages),
    ).rejects.toThrow('The source went away');
    await writeComments(h.sql, client, rowContext(store), pages);
    await writeComments(h.sql, client, rowContext(store), pages);
    const [count] = await h.sql<{ issues: number; comments: number }[]>`
      select (select count(*)::int from issues where project_id = ${project.id}) as issues,
        (select count(*)::int from comments where target_id = ${target}) as comments`;
    expect(count).toEqual({ issues: 2, comments: 2 });
  });
});
