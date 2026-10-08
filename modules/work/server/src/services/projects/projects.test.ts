import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import { createProjectsService } from './projects.ts';

const actor = { kind: 'user' as const, id: '0199c0de-0000-7000-8000-000000000001' };

function contextWhere(allowed: boolean): RequestContext & { authorize: ReturnType<typeof vi.fn> } {
  const authorize = vi.fn(async () => {
    if (!allowed) throw new ForbiddenError('No');
  });
  return { actor, authorize, authz: { authorize } as never };
}

describe('projects service', () => {
  it('authorizes by capability before it reads anything', async () => {
    const database = vi.fn() as unknown as SqlClient;
    const service = createProjectsService({ database });
    const ctx = contextWhere(false);
    await expect(service.list(ctx, { limit: 50, archived: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'module',
      moduleId: 'work',
    });
    expect(database).not.toHaveBeenCalled();
  });
});
