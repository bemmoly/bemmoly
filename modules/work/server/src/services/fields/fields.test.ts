import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { actor, contextWhere, fakeSql } from '../test-support.ts';
import { createFieldsService } from './index.ts';

const fieldId = '0199c0de-0000-7000-8000-000000000030';
const field = {
  id: fieldId,
  project_id: null,
  origin_id: null,
  key: 'severity',
  name: 'Severity',
  kind: 'select',
  options: [{ value: 'sev1', label: 'Sev 1' }],
  filterable: true,
  ai_fill: false,
  created_at: '2026-10-08T09:00:00.000Z',
  updated_at: '2026-10-08T09:00:00.000Z',
};

describe('fields service', () => {
  it('authorizes on the module for the org defaults and presents camelCase', async () => {
    const sql = fakeSql([[field]]);
    const ctx = contextWhere(true);
    const { items } = await createFieldsService({ database: sql.client }).list(ctx, null);
    expect(items[0]).toMatchObject({ key: 'severity', aiFill: false, filterable: true });
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'module',
      moduleId: 'work',
    });
  });

  it('turns a duplicate key into a conflict and a missing id into not found', async () => {
    const sql = fakeSql([[]]);
    const service = createFieldsService({ database: sql.client });
    await expect(
      service.update(contextWhere(true), null, fieldId, { name: 'Sev' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const failing = fakeSql([]);
    failing.client = Object.assign(
      () => Promise.reject(Object.assign(new Error('dup'), { code: '23505' })),
      { unsafe: () => ({ fragment: '' }) },
    ) as never;
    await expect(
      createFieldsService({ database: failing.client }).create(contextWhere(true), null, {
        key: 'severity',
        name: 'Severity',
        kind: 'select',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('refuses writes without the configure capability before changing anything', async () => {
    const sql = fakeSql([[{ project_id: null }]]);
    await expect(
      createFieldsService({ database: sql.client }).remove(contextWhere(false), null, fieldId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(sql.statements).toHaveLength(1);
    expect(sql.statements[0]).toContain('select project_id from');
  });
});
