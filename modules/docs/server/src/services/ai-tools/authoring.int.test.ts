import type { AiToolDefinition, AiToolRunContext, RequestContext } from '@bemmoly/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startDocsHarness, type DocsHarness } from '../int-support.ts';
import { docsAiTools } from './index.ts';

let h: DocsHarness | undefined;
let skipped = '';
let tools: Map<string, AiToolDefinition>;

beforeAll(async () => {
  const started = await startDocsHarness();
  if (!started.available) {
    skipped = started.reason;
    return;
  }
  h = started.harness;
  await h.space('TRP');
  tools = new Map(docsAiTools(h.services).map((tool) => [tool.name, tool]));
});

afterAll(async () => {
  await h?.stop();
});

const runContext = (ctx: RequestContext): AiToolRunContext => ({
  ...ctx,
  planId: '00000000-0000-7000-8000-000000000000',
  stepIndex: 0,
  attribution: 'via Bemmoly',
  runId: null,
});

async function read<T>(name: string, ctx: RequestContext, input: unknown): Promise<T> {
  const tool = tools.get(name);
  if (tool?.kind !== 'read') throw new Error(`${name} is not a read tool`);
  return (await tool.execute(ctx, tool.input.parse(input))) as T;
}

async function write(name: string, ctx: RequestContext, input: unknown) {
  const tool = tools.get(name);
  if (tool?.kind !== 'write') throw new Error(`${name} is not a write tool`);
  const parsed = tool.input.parse(input);
  await tool.authorize(ctx, parsed);
  const outcome = await tool.run(runContext(ctx), parsed);
  return { result: outcome.result ?? {}, undo: () => tool.undo?.(runContext(ctx), outcome.undo) };
}

const markdown = (words: number) =>
  `# Deploys\n\n- Build\n- Ship\n\n${'Roll the canary before the fleet. '.repeat(words / 6)}`;

describe('Docs authoring tools', () => {
  it('files a long Markdown page under a folder page and lists the tree', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const folder = await write('docs_create_page', member, { spaceKey: 'trp', title: 'Payments' });
    expect(folder.result).toMatchObject({ title: 'Payments', spaceKey: 'TRP', parentId: null });
    const body = markdown(8000);
    expect(body.length).toBeGreaterThan(40_000);
    const page = await write('docs_create_page', member, {
      spaceKey: 'TRP',
      parentId: folder.result['id'],
      title: 'Deploys',
      body,
    });
    const id = String(page.result['id']);
    const stored = await h.services.pages.get(member, id);
    expect(stored.wordCount).toBeGreaterThan(6000);
    const got = await read<{ markdown: string }>('docs_get_page', member, {
      pageId: id,
      markdown: true,
    });
    expect(got.markdown).toContain('# Deploys');
    expect(got.markdown).toContain('- Ship');

    const tree = await read<{ pages: { id: string; depth: number; hasChildren: boolean }[] }>(
      'docs_list_tree',
      member,
      { spaceKey: 'TRP' },
    );
    expect(tree.pages.map((p) => [p.id, p.depth, p.hasChildren])).toEqual([
      [folder.result['id'], 0, true],
      [id, 1, false],
    ]);
    const roots = await read<{ pages: unknown[] }>('docs_list_tree', member, {
      spaceKey: 'TRP',
      recursive: false,
    });
    expect(roots.pages).toHaveLength(1);

    await page.undo();
    await expect(h.services.pages.get(member, id)).rejects.toThrow();
  });

  it('replaces a body with no editor connected, and undoes it', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const created = await write('docs_create_page', member, {
      spaceKey: 'TRP',
      title: 'Alerts',
      body: 'Page the on-call.',
    });
    const pageId = String(created.result['id']);
    const updated = await write('docs_update_page', member, {
      pageId,
      title: 'Alerting',
      body: '## Paging\n\nPage the secondary after ten minutes.',
    });
    expect(updated.result).toEqual({ id: pageId, title: 'Alerting' });
    const after = await read<{ markdown: string }>('docs_get_page', member, {
      pageId,
      markdown: true,
    });
    expect(after.markdown).toContain('secondary after ten minutes');
    await updated.undo();
    const back = await read<{ title: string; markdown: string }>('docs_get_page', member, {
      pageId,
      markdown: true,
    });
    expect(back.title).toBe('Alerts');
    expect(back.markdown).toContain('Page the on-call.');
  });

  it('lists visible spaces, finds pages by space key, and keeps others out', async (ctx) => {
    if (!h) return ctx.skip(skipped);
    const member = h.as(h.users.member);
    const spaces = await read<{ key: string }[]>('docs_list_spaces', member, {});
    expect(spaces.map((space) => space.key)).toContain('TRP');
    const hits = await read<{ spaceKey: string }[]>('docs_search_pages', member, { q: 'TRP' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.spaceKey === 'TRP')).toBe(true);

    const outsider = h.as(h.users.outsider);
    expect(await read<unknown[]>('docs_list_spaces', outsider, {})).toEqual([]);
    expect(await read<unknown[]>('docs_search_pages', outsider, { q: 'TRP' })).toEqual([]);
    await expect(
      write('docs_create_page', outsider, { spaceKey: 'TRP', title: 'Sneaky' }),
    ).rejects.toThrow();
    await expect(
      write('docs_create_page', h.as(h.users.viewer), { spaceKey: 'TRP', title: 'Nope' }),
    ).rejects.toThrow();
  });
});
