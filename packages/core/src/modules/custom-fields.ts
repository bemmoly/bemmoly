import type { ModuleCustomFields } from '../contracts/custom-fields.ts';
import type { CustomFieldsService } from '../services/custom-fields/index.ts';
import { ModuleLoadError } from './errors.ts';

/** `ctx.customFields`: the kernel service pinned to the module's own id, bound late. */
export function createModuleCustomFields(
  moduleId: string,
  service: () => CustomFieldsService | undefined,
): ModuleCustomFields {
  const bound = (): CustomFieldsService => {
    const fields = service();
    if (!fields) {
      throw new ModuleLoadError(
        `Module "${moduleId}": custom fields are not available in this process`,
        moduleId,
      );
    }
    return fields;
  };
  return {
    list: (entityType) => bound().listFields({ moduleId, entityType }),
    create: (actor, entityType, body) =>
      bound().createField(actor, { ...body, moduleId, entityType }),
    read: (actor, entityType, ids) => bound().readValues(actor, { moduleId, entityType }, ids),
    write: (actor, entityType, id, values, options) =>
      bound().writeValues(actor, { moduleId, entityType }, id, values, options),
  };
}
