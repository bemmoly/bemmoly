import { describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '../authz/index.ts';
import { getMe } from './users.ts';

vi.mock('./presenters.ts', () => ({
  loadUser: async (_db: unknown, id: string) => ({ id, name: 'Sam', status: 'active' }),
  presentUsers: () => [],
}));

const settings = { get: async () => null, getMany: async () => ({}) };

function contextWith(capabilities: string[]): RequestContext {
  return {
    actor: { kind: 'user', id: 'u1' },
    authz: {
      workspaceCapabilities: async () => [...capabilities],
      modulesFor: async () => new Set(['work']),
    },
  } as unknown as RequestContext;
}

async function aiEnabledFor(capabilities: string[], workspaceOn = true) {
  const me = await getMe(
    { db: {} as never, settings: settings as never, aiEnabled: async () => workspaceOn },
    contextWith(capabilities),
  );
  return me.workspace.aiEnabled;
}

describe('/me workspace.aiEnabled', () => {
  it('is on for a person whose role may use AI assist, while AI is on for them', async () => {
    expect(await aiEnabledFor(['ai.assist.use', 'work.issue.edit'])).toBe(true);
    expect(await aiEnabledFor(['ai.assist.use'], false)).toBe(false);
  });

  it('is off for a role without AI assist, so no AI surface is drawn for them', async () => {
    expect(await aiEnabledFor(['work.issue.edit'])).toBe(false);
  });
});
