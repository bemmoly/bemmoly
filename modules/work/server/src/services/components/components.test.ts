import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { contextWhere, fakeSql } from '../test-support.ts';
import { createComponentsService } from './index.ts';

const projectId = '0199c0de-0000-7000-8000-000000000010';
const project = { id: projectId, key: 'PLT', scheme_overrides: {} };
const lead = '0199c0de-0000-7000-8000-000000000002';

describe('components service', () => {
  it('refuses a lead who is not an active person before it writes', async () => {
    const sql = fakeSql([[project], []]);
    const service = createComponentsService({ database: sql.client });
    await expect(
      service.create(contextWhere(true), 'PLT', { name: 'Billing', leadUserId: lead }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(sql.statements).toHaveLength(2);
    expect(sql.statements[1]).toMatch(/status = 'active'/);
  });

  it('stores a component without a lead without asking about people', async () => {
    const row = {
      id: '0199c0de-0000-7000-8000-000000000040',
      project_id: projectId,
      name: 'Billing',
      description: null,
      lead_user_id: null,
      created_at: '2026-10-09T09:00:00.000Z',
      updated_at: '2026-10-09T09:00:00.000Z',
    };
    const sql = fakeSql([[project], [row]]);
    const service = createComponentsService({ database: sql.client });
    const component = await service.create(contextWhere(true), 'PLT', { name: 'Billing' });
    expect(component).toMatchObject({ name: 'Billing', leadUserId: null });
    expect(sql.statements[1]).toMatch(/^insert into components/);
  });
});
