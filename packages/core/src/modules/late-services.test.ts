import { describe, expect, it, vi } from 'vitest';
import type { Approvals } from '../contracts/approvals.ts';
import type { CustomFieldsService } from '../services/custom-fields/index.ts';
import { ModuleLoadError } from './errors.ts';
import { lateServicesFor } from './late-services.ts';

const actor = { kind: 'user', id: 'u1' } as const;

describe('the late kernel services a module sees', () => {
  it('pins custom fields to the module’s own id', async () => {
    const service = {
      listFields: vi.fn(async () => []),
      readValues: vi.fn(async () => new Map()),
    } as unknown as CustomFieldsService;
    const { customFields } = lateServicesFor('people', { customFields: () => service });
    await customFields?.list('person');
    await customFields?.read(actor, 'person', ['p1']);
    expect(service.listFields).toHaveBeenCalledWith({ moduleId: 'people', entityType: 'person' });
    expect(service.readValues).toHaveBeenCalledWith(
      actor,
      { moduleId: 'people', entityType: 'person' },
      ['p1'],
    );
  });

  it('lets a module define defaults only for its own workflows', async () => {
    const engine = { ensureWorkflow: vi.fn(async () => undefined) } as unknown as Approvals;
    const { approvals } = lateServicesFor('people', { approvals: () => engine });
    const spec = { stages: [{ name: 'Manager', approvers: [{ type: 'manager' as const }] }] };
    await approvals?.ensureWorkflow({ moduleId: 'people', key: 'people.leave', name: 'L', spec });
    expect(() =>
      approvals?.ensureWorkflow({ moduleId: 'work', key: 'work.x', name: 'X', spec }),
    ).toThrow(ModuleLoadError);
  });

  it('fails loudly when a service is not bound in this process', () => {
    const { customFields } = lateServicesFor('people', { customFields: () => undefined });
    expect(() => customFields?.list('person')).toThrow(ModuleLoadError);
  });
});
