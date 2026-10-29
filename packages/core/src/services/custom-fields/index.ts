import type { FieldFilter, FieldScope, FieldSort } from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor, SqlFragment } from '../../contracts/sql.ts';
import type { CustomFieldsDeps } from './context.ts';
import { createDefinitionsService } from './definitions.ts';
import { createFormsService } from './forms.ts';
import { compileFieldQuery } from './query.ts';
import { createValuesService } from './values.ts';

export { CUSTOM_FIELDS_CAPABILITY, type CustomFieldsDeps } from './context.ts';
export { fieldOrder, fieldPredicate, type CompiledQuery } from './query.ts';
export { shadowOf, type WriteOptions } from './values.ts';

/**
 * Typed custom fields and forms for any module (ADR 0052). The module authorizes its entity;
 * this service enforces the fields: definitions, validation, role visibility and editing.
 */
export function createCustomFieldsService(deps: CustomFieldsDeps) {
  const definitions = createDefinitionsService(deps);
  const values = createValuesService(deps);
  const forms = createFormsService(deps, values);
  return {
    listFields: definitions.list,
    createField: definitions.create,
    updateField: definitions.update,
    readValues: values.read,
    writeValues: values.write,
    removeEntityValues: values.removeEntities,
    compileQuery: (
      actor: Actor,
      scope: FieldScope,
      query: { filters?: readonly FieldFilter[]; sort?: readonly FieldSort[] },
      entity: SqlFragment,
      db: SqlExecutor = deps.sql,
    ) => compileFieldQuery(db, actor, scope, query, entity),
    getForm: forms.get,
    createForm: forms.create,
    submitForm: forms.submit,
  };
}

export type CustomFieldsService = ReturnType<typeof createCustomFieldsService>;
