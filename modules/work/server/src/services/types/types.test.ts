import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { actor, contextWhere, fakeSql } from '../test-support.ts';
import { createIssueTypesService } from './index.ts';

const projectId = '0199c0de-0000-7000-8000-000000000010';
const typeId = '0199c0de-0000-7000-8000-000000000020';
const project = {
  id: projectId,
  key: 'PLT',
  name: 'Platform',
  description: null,
  team_id: null,
  method: 'scrum',
  scheme_overrides: {},
  default_space_id: null,
  archived_at: null,
  created_at: '2026-10-08T09:00:00.000Z',
  updated_at: '2026-10-08T09:00:00.000Z',
};
const type = {
  id: typeId,
  project_id: null,
  origin_id: null,
  key: 'story',
  name: 'Story',
  description: null,
  icon: null,
  color: null,
  level: 'standard',
  position: 0,
  created_at: '2026-10-08T09:00:00.000Z',
  updated_at: '2026-10-08T09:00:00.000Z',
};

describe('issue types service', () => {
  it('reads the org defaults at org scope after authorizing on the module', async () => {
    const sql = fakeSql([[type]]);
    const ctx = contextWhere(true);
    const { items } = await createIssueTypesService({ database: sql.client }).list(ctx, null);
    expect(items[0]).toMatchObject({ key: 'story', projectId: null });
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'module',
      moduleId: 'work',
    });
    expect(sql.statements[0]).toContain('project_id is not distinct from ?');
  });

  it('reads the org defaults for a project that has not overridden them', async () => {
    const sql = fakeSql([[project], [type]]);
    const ctx = contextWhere(true);
    await createIssueTypesService({ database: sql.client }).list(ctx, 'PLT');
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'project',
      id: projectId,
      moduleId: 'work',
    });
  });

  it('refuses to edit inside a project until the scheme is overridden', async () => {
    const sql = fakeSql([[project]]);
    const service = createIssueTypesService({ database: sql.client });
    await expect(
      service.create(contextWhere(true), 'PLT', { key: 'bug', name: 'Bug' }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      service.create(contextWhere(false), null, { key: 'bug', name: 'Bug' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('needs every type of the scope named once to reorder', async () => {
    const sql = fakeSql([[type, { ...type, id: projectId, key: 'bug' }]]);
    const service = createIssueTypesService({ database: sql.client });
    await expect(
      service.reorder(contextWhere(true), null, { ids: [typeId] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
