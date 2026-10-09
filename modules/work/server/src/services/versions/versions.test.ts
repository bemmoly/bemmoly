import { describe, expect, it, vi } from 'vitest';
import { contextWhere, fakeSql } from '../test-support.ts';
import { createVersionsService } from './index.ts';

const projectId = '0199c0de-0000-7000-8000-000000000010';
const project = { id: projectId, key: 'PLT', scheme_overrides: {} };
const version = {
  id: '0199c0de-0000-7000-8000-000000000030',
  project_id: projectId,
  name: '1.0',
  description: null,
  release_at: '2026-11-02',
  status: 'unreleased' as const,
  released_at: null,
  created_at: '2026-10-09T09:00:00.000Z',
  updated_at: '2026-10-09T09:00:00.000Z',
};

describe('versions service', () => {
  it('reads the release date as a plain date', async () => {
    const sql = fakeSql([[project], [version]]);
    const service = createVersionsService({ database: sql.client });
    const page = await service.list(contextWhere(true), 'PLT', { limit: 50, status: 'unreleased' });
    expect(page.items[0]).toMatchObject({ releaseAt: '2026-11-02', releasedAt: null });
  });

  it('names the audit row after the new status when the status changes', async () => {
    const released = {
      ...version,
      status: 'released' as const,
      released_at: '2026-10-09T10:00:00.000Z',
    };
    const sql = fakeSql([[project], [version], [released]]);
    const audit = { record: vi.fn(async () => undefined) };
    const service = createVersionsService({ database: sql.client, audit });
    const result = await service.update(contextWhere(true), 'PLT', version.id, {
      status: 'released',
    });
    expect(result).toMatchObject({ status: 'released', releasedAt: '2026-10-09T10:00:00.000Z' });
    expect(sql.statements[2]).toMatch(/released_at = case when \? = 'unreleased' then null/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'version.released' }),
    );
  });
});
