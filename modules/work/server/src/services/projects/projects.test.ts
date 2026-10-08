import { ConflictError, ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { describe, expect, it, vi } from 'vitest';
import { actor, contextWhere, fakeSql } from '../test-support.ts';
import { createProjectsService } from './index.ts';

const id = '0199c0de-0000-7000-8000-000000000010';
const row = {
  id,
  key: 'PLT',
  name: 'Platform',
  description: null,
  team_id: null,
  method: 'scrum' as const,
  scheme_overrides: {},
  default_space_id: null,
  archived_at: null,
  created_at: '2026-10-08T09:00:00.000Z',
  updated_at: '2026-10-08T09:00:00.000Z',
};

describe('projects service', () => {
  it('authorizes by capability before it reads anything', async () => {
    const sql = fakeSql([]);
    const service = createProjectsService({ database: sql.client });
    const ctx = contextWhere(false);
    await expect(service.list(ctx, { limit: 50, archived: false })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.issue.view', {
      kind: 'module',
      moduleId: 'work',
    });
    expect(sql.statements).toEqual([]);
  });

  it('creates the counter row and the audit row in the same transaction', async () => {
    const sql = fakeSql([[row]]);
    const audit = { record: vi.fn(async () => undefined) };
    const service = createProjectsService({ database: sql.client, audit });
    const project = await service.create(contextWhere(true), { key: 'plt', name: 'Platform' });
    expect(project).toMatchObject({ key: 'PLT', schemeOverrides: {} });
    expect(sql.statements[0]).toMatch(/^insert into projects/);
    expect(sql.statements[1]).toMatch(/^insert into project_counters/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'project.created', target: { kind: 'project', id } }),
      sql.client,
    );
  });

  it('turns a duplicate key into a conflict', async () => {
    const sql = fakeSql([]);
    sql.client.begin = async () => {
      throw Object.assign(new Error('duplicate'), { code: '23505' });
    };
    const service = createProjectsService({ database: sql.client });
    await expect(
      service.create(contextWhere(true), { key: 'PLT', name: 'Platform' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('audits an archive with the row before and after', async () => {
    const archived = { ...row, archived_at: '2026-10-08T10:00:00.000Z' };
    const sql = fakeSql([[row], [archived]]);
    const audit = { record: vi.fn(async () => undefined) };
    const service = createProjectsService({ database: sql.client, audit });
    const project = await service.archive(contextWhere(true), 'PLT');
    expect(project.archivedAt).toBe('2026-10-08T10:00:00.000Z');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'project.archived',
        before: expect.objectContaining({ archivedAt: null }),
        after: expect.objectContaining({ archivedAt: '2026-10-08T10:00:00.000Z' }),
      }),
    );
  });

  it('scopes configuration to the project and refuses to delete a live one', async () => {
    const sql = fakeSql([[row]]);
    const service = createProjectsService({ database: sql.client });
    const ctx = contextWhere(true);
    await expect(service.remove(ctx, 'PLT')).rejects.toBeInstanceOf(ConflictError);
    expect(ctx.authorize).toHaveBeenCalledWith(actor, 'work.project.configure', {
      kind: 'project',
      id,
      moduleId: 'work',
    });
    await expect(service.get(ctx, 'NOPE')).rejects.toBeInstanceOf(NotFoundError);
  });
});
