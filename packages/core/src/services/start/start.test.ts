import { ForbiddenError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { RequestContext } from '../authz/index.ts';
import { createStartService } from './index.ts';

const empty = { waiting: null, needsYou: [], recent: [] };

function contextFor(reachable: string[]): RequestContext {
  return {
    actor: { kind: 'user', userId: 'u1' },
    authz: { modulesFor: async () => new Set(reachable) },
  } as unknown as RequestContext;
}

describe('the start page summaries', () => {
  it('asks only enabled modules the person can open, in registration order', async () => {
    const service = createStartService({
      sources: () => [
        {
          moduleId: 'work',
          summaryForUser: async () => ({
            waiting: { count: 2, label: 'issues assigned to you' },
            needsYou: [{ id: 'issue:A-1', title: 'Fix', path: '/work/issue/A-1' }],
            recent: [],
          }),
        },
        { moduleId: 'docs', summaryForUser: async () => empty },
        { moduleId: 'pipelines', summaryForUser: async () => empty },
        { moduleId: 'off', summaryForUser: async () => empty },
      ],
      isEnabled: (id) => id !== 'off',
    });
    const items = await service.summaries(contextFor(['work', 'docs', 'off']));
    expect(items.map((item) => item.moduleId)).toEqual(['work', 'docs']);
    expect(items[0]?.needsYou[0]).toEqual({
      id: 'issue:A-1',
      title: 'Fix',
      path: '/work/issue/A-1',
      at: null,
    });
  });

  it('leaves out a module that refuses the person and fails on any other error', async () => {
    const refusing = createStartService({
      sources: () => [
        {
          moduleId: 'work',
          summaryForUser: async () => {
            throw new ForbiddenError('No');
          },
        },
        { moduleId: 'docs', summaryForUser: async () => empty },
      ],
      isEnabled: () => true,
    });
    const items = await refusing.summaries(contextFor(['work', 'docs']));
    expect(items.map((item) => item.moduleId)).toEqual(['docs']);

    const broken = createStartService({
      sources: () => [
        {
          moduleId: 'docs',
          summaryForUser: async () => {
            throw new Error('boom');
          },
        },
      ],
      isEnabled: () => true,
    });
    await expect(broken.summaries(contextFor(['docs']))).rejects.toThrow('boom');
  });
});
