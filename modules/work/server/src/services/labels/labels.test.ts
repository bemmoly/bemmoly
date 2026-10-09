import { ConflictError, ForbiddenError } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import { actor, contextWhere, fakeSql } from '../test-support.ts';
import { createLabelsService } from './index.ts';

const projectId = '0199c0de-0000-7000-8000-000000000010';
const project = { id: projectId, key: 'PLT', scheme_overrides: {} };
const label = {
  id: '0199c0de-0000-7000-8000-000000000020',
  project_id: projectId,
  name: 'frontend',
  color: null,
  created_at: '2026-10-09T09:00:00.000Z',
  updated_at: '2026-10-09T09:00:00.000Z',
};

describe('labels service', () => {
  it('checks issue view on the project before it lists, and filters by prefix', async () => {
    const sql = fakeSql([[project], [label]]);
    const service = createLabelsService({ database: sql.client });
    const ctx = contextWhere(true);
    const page = await service.list(ctx, 'PLT', { limit: 50, q: 'fr' });
    expect(page).toEqual({
      items: [expect.objectContaining({ name: 'frontend' })],
      nextCursor: null,
    });
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'project',
      id: projectId,
      moduleId: 'work',
    });
    expect(sql.statements[1]).toMatch(/lower\(name\) like \?.*order by lower\(name\), id/);
  });

  it('lets an issue editor add a label, audited and announced', async () => {
    const sql = fakeSql([[project], [label]]);
    const audit = { record: vi.fn(async () => undefined) };
    const realtime = { publish: vi.fn(async () => undefined) };
    const service = createLabelsService({ database: sql.client, audit, realtime });
    const ctx = contextWhere(true);
    await service.create(ctx, 'PLT', { name: 'frontend' });
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.edit', expect.anything());
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'label.created', target: { kind: 'label', id: label.id } }),
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'work.project.changed', projectId }),
    );
  });

  it('turns a duplicate name into a conflict', async () => {
    const sql = fakeSql([[project]]);
    const tag = sql.client;
    const failing = Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings[0]?.trim().startsWith('insert')) {
          return Promise.reject(Object.assign(new Error('duplicate'), { code: '23505' }));
        }
        return (tag as unknown as (...args: unknown[]) => unknown)(strings, ...values);
      },
      { unsafe: tag.unsafe },
    );
    const service = createLabelsService({ database: failing as never });
    await expect(service.create(contextWhere(true), 'PLT', { name: 'UI' })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('stops a refused rename before it reads the label', async () => {
    const sql = fakeSql([[project]]);
    const ctx = contextWhere(false);
    await expect(
      createLabelsService({ database: sql.client }).update(ctx, 'PLT', label.id, { name: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.project.configure', expect.anything());
    expect(sql.statements).toHaveLength(1);
  });
});
