import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BOOT_ORIGIN, type SignedInApp } from './boot-harness.ts';

/*
 * What the MCP integration tests share: a workspace with Work and Docs content, a second
 * person, personal access tokens, and the official SDK client pointed at the real server.
 */

/** Inside the MCP stream's assigned range. */
export const MCP_TEST_PORT = 3421;

export type Call = (
  method: string,
  url: string,
  payload?: unknown,
  cookie?: string,
) => Promise<Record<string, unknown> | null>;

export function caller(app: SignedInApp): Call {
  return async (method, url, payload, cookie) => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
      ...(cookie ? { headers: { cookie } } : {}),
    });
    if (response.statusCode >= 400) throw new Error(`${method} ${url}: ${response.body}`);
    return response.statusCode === 204 ? null : (response.json() as Record<string, unknown>);
  };
}

/** Invites and signs in a member; returns their session cookie and id. */
export async function addMember(app: SignedInApp, call: Call, email: string, name: string) {
  const roles = (await call('GET', '/roles'))!.items as { id: string; key: string }[];
  const roleId = roles.find((role) => role.key === 'member')!.id;
  const invited = (await call('POST', '/invitations', { emails: [email], roleId }))!;
  const items = invited.items as { acceptUrl: string }[];
  const token = /token=([\w-]+)/.exec(items[0]!.acceptUrl)![1];
  const accepted = await app.instance.app.inject({
    method: 'POST',
    url: `/api/v1/auth/invitations/${token}/accept`,
    headers: { origin: BOOT_ORIGIN },
    payload: { name, password: 'twelve chars ok' },
  });
  const header = accepted.headers['set-cookie'];
  const cookie = (Array.isArray(header) ? header : [header ?? ''])
    .map((value) => value.split(';')[0])
    .join('; ');
  return { cookie, id: (accepted.json() as { user: { id: string } }).user.id };
}

/** Work and Docs on, a project with one issue, a space with one page. */
export async function seedWorkspace(call: Call) {
  for (const id of ['work', 'docs']) {
    await call('POST', `/admin/modules/${id}/enable`, { access: { mode: 'everyone' } });
  }
  const project = (await call('POST', '/work/projects', { key: 'PLT', name: 'Platform' }))!;
  const types = (await call('GET', '/work/projects/PLT/issue-types'))!.items as {
    id: string;
    key: string;
  }[];
  await call('POST', '/work/issues', {
    projectId: project.id,
    typeId: types.find((type) => type.key === 'task')!.id,
    title: 'Warm the cache',
  });
  const space = (await call('POST', '/docs/spaces', { key: 'ENG', name: 'Engineering' }))!;
  const page = (await call('POST', '/docs/pages', { spaceId: space.id, title: 'Cache plan' }))!;
  return { pageId: page.id as string };
}

export async function createToken(
  call: Call,
  body: { name: string; scopes: string[]; modules?: string[] },
  cookie?: string,
): Promise<string> {
  return (await call('POST', '/api-tokens', body, cookie))!.token as string;
}

export const setSetting = (call: Call, key: string, value: unknown) =>
  call('PUT', `/admin/settings/${key}`, { value });

/** An SDK client connected to `/mcp<path>` with the token; the caller closes it. */
export async function connect(base: string, path: string, token: string): Promise<Client> {
  const client = new Client({ name: 'bemmoly-tests', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp${path}`), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

export async function toolNames(base: string, path: string, token: string): Promise<string[]> {
  const client = await connect(base, path, token);
  try {
    return (await client.listTools()).tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
  }
}

export const textOf = (result: object) =>
  (((result as { content?: unknown }).content ?? []) as { type: string; text?: string }[])
    .map((part) => part.text ?? '')
    .join('\n');
