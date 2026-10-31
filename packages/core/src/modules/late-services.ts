import type { Approvals } from '../contracts/approvals.ts';
import type { ModuleCustomFields } from '../contracts/custom-fields.ts';
import type { CustomFieldsService } from '../services/custom-fields/index.ts';
import { createModuleApprovals } from './approvals.ts';
import { createModuleCustomFields } from './custom-fields.ts';

/** Kernel services wired after modules register; each is read on every call. */
export interface LateServices {
  approvals?: () => Approvals | undefined;
  customFields?: () => CustomFieldsService | undefined;
}

/** The module's views of the late services that this process has. */
export function lateServicesFor(
  moduleId: string,
  late: LateServices,
): { approvals?: Approvals; customFields?: ModuleCustomFields } {
  return {
    ...(late.approvals ? { approvals: createModuleApprovals(moduleId, late.approvals) } : {}),
    ...(late.customFields
      ? { customFields: createModuleCustomFields(moduleId, late.customFields) }
      : {}),
  };
}
