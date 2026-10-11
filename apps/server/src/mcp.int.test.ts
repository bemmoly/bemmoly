import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';
import {
  addMember,
  caller,
  connect,
  createToken,
  MCP_TEST_PORT,
  seedWorkspace,
  setSetting,
  textOf,
  toolNames,
  type Call,
} from './mcp-harness.ts';

/*
 * The built-in MCP server through the official SDK client against the real host: off until an
 * admin turns it on, segregated by module, limited by token scope and module list, and every
 * call made as the token's person through the same checks as the API.
 */

const base = `http://127.0.0.1:${MCP_TEST_PORT}`;

describe('mcp server', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;
  let call: Call;
  const tokens: Record<'admin' | 'readOnly' | 'workOnly' | 'member', string> = {
    admin: '',
    readOnly: '',
    workOnly: '',
    member: '',
  };
  let pageId = '';

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    app = await harness.boot();
    call = caller(app);
    ({ pageId } = await seedWorkspace(call));
    const sam = await addMember(app, call, 'sam@acmelabs.dev', 'Sam R.');
    tokens.admin = await createToken(call, { name: 'Editor', scopes: ['read', 'write'] });
    tokens.readOnly = await createToken(call, { name: 'Reader', scopes: ['read'] });
    tokens.workOnly = await createToken(call, {
      name: 'Work only',
      scopes: ['read', 'write'],
      modules: ['work'],
    });
    tokens.member = await createToken(call, { name: 'Sam', scopes: ['read', 'write'] }, sam.cookie);
    await app.instance.app.listen({ port: MCP_TEST_PORT, host: '127.0.0.1' });
  });

  afterAll(async () => harness?.stop());

  it('refuses every client while MCP is off, the default', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await expect(connect(base, '', tokens.admin)).rejects.toThrow(/turned the MCP server off/);
    await setSetting(call, 'mcp.enabled', true);
  });

  it('refuses a missing or unknown token', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await expect(connect(base, '', 'bm_pat_not-a-real-token')).rejects.toThrow(/401|invalid/);
    const anonymous = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get('www-authenticate')).toMatch(/^Bearer/);
  });

  it('lists every module on /mcp and one module on /mcp/work or ?modules=docs', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const all = await toolNames(base, '', tokens.admin);
    expect(all).toEqual(
      expect.arrayContaining([
        'bemmoly.search',
        'work.get_issue',
        'work.set_priority',
        'docs.search_pages',
      ]),
    );
    const work = await toolNames(base, '/work', tokens.admin);
    expect(work).toContain('work.search_issues');
    expect(work.some((name) => name.startsWith('docs.'))).toBe(false);
    const docs = await toolNames(base, '?modules=docs', tokens.admin);
    expect(docs).toContain('docs.get_page');
    expect(docs.some((name) => name.startsWith('work.'))).toBe(false);
  });

  it('calls read and write tools as the person, and audits the write', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const client = await connect(base, '', tokens.admin);
    try {
      const issue = await client.callTool({ name: 'work.get_issue', arguments: { key: 'PLT-1' } });
      expect(issue.isError).toBeFalsy();
      expect(textOf(issue)).toContain('Warm the cache');
      const found = await client.callTool({ name: 'bemmoly.search', arguments: { q: 'cache' } });
      expect(textOf(found)).toContain('PLT-1');
      const changed = await client.callTool({
        name: 'work.set_priority',
        arguments: { key: 'PLT-1', priority: 'high' },
      });
      expect(changed.isError).toBeFalsy();
      const bad = await client.callTool({ name: 'work.get_issue', arguments: { key: 7 } });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
    }
    const after = (await call('GET', '/work/issues/PLT-1'))!;
    expect(after.priority).toBe('high');
    const sql = app.instance.database!.sql;
    const rows = await sql<{ actor_kind: string; target_id: string }[]>`
      select actor_kind, target_id from audit_log where action = 'mcp.tool_called'`;
    expect(rows).toEqual([{ actor_kind: 'api_token', target_id: 'work.set_priority' }]);
  });

  it('serves issues, projects, spaces and pages as resources, and prompts', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const client = await connect(base, '', tokens.admin);
    try {
      const listed = (await client.listResources()).resources.map((resource) => resource.uri);
      expect(listed).toEqual(
        expect.arrayContaining(['bemmoly://work/projects/PLT', 'bemmoly://docs/spaces/ENG']),
      );
      const templates = (await client.listResourceTemplates()).resourceTemplates;
      expect(templates.map((template) => template.uriTemplate)).toEqual(
        expect.arrayContaining(['bemmoly://work/issues/{key}', 'bemmoly://docs/pages/{id}']),
      );
      const issue = await client.readResource({ uri: 'bemmoly://work/issues/PLT-1' });
      expect(JSON.stringify(issue.contents)).toContain('# PLT-1 Warm the cache');
      const page = await client.readResource({ uri: `bemmoly://docs/pages/${pageId}` });
      expect(JSON.stringify(page.contents)).toContain('# Cache plan');
      await expect(client.readResource({ uri: 'bemmoly://work/issues/PLT-99' })).rejects.toThrow(
        /not found/i,
      );
      const prompts = (await client.listPrompts()).prompts.map((prompt) => prompt.name);
      expect(prompts).toEqual(expect.arrayContaining(['work.triage_issue', 'docs.review_page']));
      const triage = await client.getPrompt({
        name: 'work.triage_issue',
        arguments: { key: 'PLT-1' },
      });
      expect(JSON.stringify(triage.messages)).toContain('Warm the cache');
    } finally {
      await client.close();
    }
  });

  it('files Markdown pages into a space folder and finds them by space key', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const client = await connect(base, '', tokens.admin);
    const json = <T>(result: object) => JSON.parse(textOf(result)) as T;
    type Created = { id: string; parentId: string | null };
    try {
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'docs.create_page',
          'docs.update_page',
          'docs.list_spaces',
          'docs.list_tree',
        ]),
      );
      const spaces = json<unknown[]>(
        await client.callTool({ name: 'docs.list_spaces', arguments: {} }),
      );
      expect(spaces).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'ENG' })]));
      const folder = json<Created>(
        await client.callTool({
          name: 'docs.create_page',
          arguments: { spaceKey: 'ENG', title: 'Billing service' },
        }),
      );
      expect(folder).toMatchObject({ done: true, title: 'Billing service', spaceKey: 'ENG' });
      const body = `## Runbook\n\n${'Restart the worker when the queue backs up. '.repeat(1000)}`;
      const runbook = json<Created>(
        await client.callTool({
          name: 'docs.create_page',
          arguments: { spaceKey: 'ENG', parentId: folder.id, title: 'Runbook', body },
        }),
      );
      expect(runbook).toMatchObject({ parentId: folder.id, href: `/docs/p/${runbook.id}` });
      const tree = json<{ pages: unknown[] }>(
        await client.callTool({ name: 'docs.list_tree', arguments: { spaceKey: 'ENG' } }),
      );
      expect(tree.pages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: folder.id, hasChildren: true, depth: 0 }),
          expect.objectContaining({ id: runbook.id, parentId: folder.id, depth: 1 }),
        ]),
      );
      const read = json<{ markdown: string }>(
        await client.callTool({
          name: 'docs.get_page',
          arguments: { pageId: runbook.id, markdown: true },
        }),
      );
      expect(read.markdown).toContain('## Runbook');
      expect(read.markdown.length).toBeGreaterThan(40_000);
      const found = json<{ id: string }[]>(
        await client.callTool({ name: 'docs.search_pages', arguments: { q: 'ENG' } }),
      );
      expect(found.map((hit) => hit.id)).toContain(runbook.id);
    } finally {
      await client.close();
    }
  });

  it('hides write tools from a read-only token and refuses its writes', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const names = await toolNames(base, '', tokens.readOnly);
    expect(names).toContain('work.get_issue');
    expect(names).not.toContain('work.set_priority');
    const client = await connect(base, '', tokens.readOnly);
    try {
      await expect(
        client.callTool({
          name: 'work.set_priority',
          arguments: { key: 'PLT-1', priority: 'low' },
        }),
      ).rejects.toThrow(/Unknown tool/);
    } finally {
      await client.close();
    }
  });

  it('keeps a token limited to Work out of Docs, over MCP and the API', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const names = await toolNames(base, '', tokens.workOnly);
    expect(names).toContain('work.get_issue');
    expect(names.some((name) => name.startsWith('docs.'))).toBe(false);
    expect(await toolNames(base, '/docs', tokens.workOnly)).toEqual(['bemmoly.search']);
    const viaApi = await app.instance.app.inject({
      method: 'GET',
      url: '/api/v1/docs/spaces',
      headers: { authorization: `Bearer ${tokens.workOnly}` },
    });
    expect(viaApi.statusCode).toBe(403);
  });

  it('runs as the person: a member outside the project is refused', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const client = await connect(base, '', tokens.member);
    try {
      const denied = await client.callTool({ name: 'work.get_issue', arguments: { key: 'PLT-1' } });
      expect(denied.isError).toBe(true);
      const write = await client.callTool({
        name: 'work.set_priority',
        arguments: { key: 'PLT-1', priority: 'low' },
      });
      expect(write.isError).toBe(true);
    } finally {
      await client.close();
    }
    expect((await call('GET', '/work/issues/PLT-1'))!.priority).toBe('high');
  });

  it('exposes only the modules the admin chose, and nothing once turned off', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    await setSetting(call, 'mcp.modules', ['work']);
    const names = await toolNames(base, '', tokens.admin);
    expect(names.some((name) => name.startsWith('docs.'))).toBe(false);
    await expect(connect(base, '/docs', tokens.admin)).rejects.toThrow(/not available over MCP/);
    await setSetting(call, 'mcp.enabled', false);
    await expect(connect(base, '/work', tokens.admin)).rejects.toThrow(/turned the MCP server off/);
  });
});
