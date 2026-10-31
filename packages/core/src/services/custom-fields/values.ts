import {
  ForbiddenError,
  validateFieldValues,
  ValidationError,
  type CustomFieldDefinition,
  type FieldScope,
  type FieldValues,
  type MoneyValue,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { allows, definitionsOf, viewerRoles, type CustomFieldsDeps } from './context.ts';

interface Shadow {
  text: string | null;
  number: number | null;
  date: string | null;
  bool: boolean | null;
}

/** The typed copy filters and sorts read; multi-select is matched on the JSONB itself. */
export function shadowOf(field: Pick<CustomFieldDefinition, 'kind'>, value: unknown): Shadow {
  const shadow: Shadow = { text: null, number: null, date: null, bool: null };
  switch (field.kind) {
    case 'number':
      shadow.number = value as number;
      break;
    case 'money':
      shadow.number = (value as MoneyValue).amountMinor;
      shadow.text = (value as MoneyValue).currency;
      break;
    case 'date':
      shadow.date = value as string;
      break;
    case 'boolean':
      shadow.bool = value as boolean;
      break;
    case 'multi_select':
      break;
    default:
      shadow.text = value as string;
  }
  return shadow;
}

export interface WriteOptions {
  /** `create` checks required fields and fills defaults; `update` touches only given keys. */
  mode: 'create' | 'update';
  /** The module's open transaction, so the entity and its values commit together. */
  transaction?: SqlExecutor;
  /** Keys a form showed; the rest are neither required nor written. */
  only?: ReadonlySet<string>;
}

export function invalid(issues: { key: string; message: string }[]): never {
  const named = issues.map((issue) => `${issue.key}: ${issue.message}`).join('; ');
  throw new ValidationError(`Some fields are not valid: ${named}`, {
    details: { issues: issues.map((issue) => ({ path: issue.key, message: issue.message })) },
  });
}

/** Refuses values for fields the actor's role may not edit, before anything is validated. */
export async function assertEditable(
  db: SqlExecutor,
  actor: Actor,
  fields: readonly CustomFieldDefinition[],
  values: FieldValues,
) {
  const roles = await viewerRoles(db, actor);
  const locked = fields.filter((f) => Object.hasOwn(values, f.key) && !allows(f.editableBy, roles));
  if (locked.length > 0)
    throw new ForbiddenError(`You cannot change ${locked.map((f) => f.label).join(', ')}`);
}

export function createValuesService(deps: CustomFieldsDeps) {
  /**
   * Validates and stores `values` on one entity. The caller has already decided the actor may
   * change the entity; this refuses fields the actor's role may not edit. Returns what was
   * stored, with `null` for cleared fields.
   */
  async function write(
    actor: Actor,
    scope: FieldScope,
    entityId: string,
    values: FieldValues,
    options: WriteOptions,
  ): Promise<FieldValues> {
    const db = options.transaction ?? deps.sql;
    const fields = await definitionsOf(db, scope);
    await assertEditable(db, actor, fields, values);
    const defaults = new Map(
      fields.filter((f) => f.defaultValue !== null).map((f) => [f.key, f.defaultValue]),
    );
    const result = validateFieldValues(fields, values, {
      mode: options.mode,
      defaults,
      ...(options.only ? { only: options.only } : {}),
    });
    if (!result.ok) invalid(result.issues);
    const byKey = new Map(fields.map((f) => [f.key, f]));
    for (const [key, value] of Object.entries(result.values)) {
      const field = byKey.get(key)!;
      if (value === null) {
        await db`delete from custom_field_values where field_id = ${field.id} and entity_id = ${entityId}`;
        continue;
      }
      const s = shadowOf(field, value);
      await db`
        insert into custom_field_values (field_id, entity_id, value, value_text, value_number,
          value_date, value_bool)
        values (${field.id}, ${entityId}, ${JSON.stringify(value)}::jsonb, ${s.text}, ${s.number},
          ${s.date}, ${s.bool})
        on conflict (field_id, entity_id) do update set value = excluded.value,
          value_text = excluded.value_text, value_number = excluded.value_number,
          value_date = excluded.value_date, value_bool = excluded.value_bool, updated_at = now()`;
    }
    return result.values;
  }

  /**
   * Values of many entities in one query, keyed by entity id, holding only the fields the
   * actor's role may see. An entity with no values maps to `{}`.
   */
  async function read(
    actor: Actor,
    scope: FieldScope,
    entityIds: readonly string[],
  ): Promise<Map<string, FieldValues>> {
    const out = new Map(entityIds.map((id) => [id, {} as FieldValues]));
    if (entityIds.length === 0) return out;
    const fields = await definitionsOf(deps.sql, scope);
    const roles = await viewerRoles(deps.sql, actor);
    const shown = fields.filter((f) => allows(f.visibleTo, roles));
    if (shown.length === 0) return out;
    const rows = await deps.sql<{ entity_id: string; key: string; value: unknown }[]>`
      select v.entity_id, d.key, v.value from custom_field_values v
      join custom_field_definitions d on d.id = v.field_id
      where v.entity_id = any(${entityIds as string[]}::uuid[])
        and v.field_id = any(${shown.map((f) => f.id)}::uuid[])`;
    for (const row of rows) out.get(row.entity_id)![row.key] = row.value;
    return out;
  }

  /** What a module calls when it deletes entities, in its own transaction. */
  async function removeEntities(db: SqlExecutor, scope: FieldScope, entityIds: readonly string[]) {
    await db`
      delete from custom_field_values v using custom_field_definitions d
      where d.id = v.field_id and d.module_id = ${scope.moduleId}
        and d.entity_type = ${scope.entityType}
        and v.entity_id = any(${entityIds as string[]}::uuid[])`;
  }

  return { write, read, removeEntities };
}
