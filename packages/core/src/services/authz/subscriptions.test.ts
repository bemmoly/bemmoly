import { describe, expect, it, vi } from 'vitest';
import { subscriptionAuthorizer, type SubscriptionLookups } from './subscriptions.ts';

const PROJECT = '0192f3a1-7c2e-7000-8000-000000000001';

function lookups(people: Record<string, { isOrgAdmin: boolean }>, members: string[]) {
  return {
    principal: vi.fn(async (userId: string) => people[userId] ?? null),
    isMember: vi.fn(async (_kind, containerId: string, userId: string) =>
      members.includes(`${containerId}|${userId}`),
    ),
  } satisfies SubscriptionLookups;
}

describe('subscription authorizer', () => {
  const reads = lookups(
    { admin: { isOrgAdmin: true }, member: { isOrgAdmin: false }, guest: { isOrgAdmin: false } },
    [`${PROJECT}|member`],
  );
  const authorize = subscriptionAuthorizer(reads);
  const project = { kind: 'project', id: PROJECT } as const;

  it('lets members and org admins into a project, and nobody else', async () => {
    expect(await authorize({ kind: 'user', id: 'member' }, project)).toBe(true);
    expect(await authorize({ kind: 'user', id: 'admin' }, project)).toBe(true);
    expect(await authorize({ kind: 'user', id: 'guest' }, project)).toBe(false);
    expect(await authorize({ kind: 'api_token', id: 't', userId: 'member' }, project)).toBe(true);
  });

  it('refuses inactive people and ids that name nothing, without querying', async () => {
    reads.isMember.mockClear();
    expect(await authorize({ kind: 'user', id: 'gone' }, project)).toBe(false);
    expect(await authorize({ kind: 'user', id: 'guest' }, { kind: 'space', id: 'PLT' })).toBe(
      false,
    );
    expect(reads.isMember).not.toHaveBeenCalled();
  });

  it('lets any active person into the workspace and module scopes', async () => {
    expect(await authorize({ kind: 'user', id: 'guest' }, { kind: 'workspace' })).toBe(true);
    expect(await authorize({ kind: 'user', id: 'guest' }, { kind: 'module', id: 'work' })).toBe(
      true,
    );
    expect(await authorize({ kind: 'user', id: 'gone' }, { kind: 'workspace' })).toBe(false);
  });
});
