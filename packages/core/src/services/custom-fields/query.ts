import {
  operatorsFor,
  ValidationError,
  type CustomFieldDefinition,
  type FieldFilter,
  type FieldScope,
  type FieldSort,
} from '@bemmoly/shared';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor, SqlFragment } from '../../contracts/sql.ts';
import { allows, definitionsOf, viewerRoles } from './context.ts';

/*
 * Filters and sorts compile to fragments over the typed shadow columns, which the module
 * embeds in its own list query against its entity id column (ADR 0052):
 *
 *   const { where, orderBy } = await fields.compile(actor, scope, { filters, sort }, sql`t.id`);
 *   sql`select t.* from tickets t where ${where} order by ${orderBy}, t.id`
 */

type Field = Pick<CustomFieldDefinition, 'id' | 'kind' | 'key'>;

function columnOf(db: SqlExecutor, field: Field): SqlFragment {
  switch (field.kind) {
    case 'number':
    case 'money':
      return db`v.value_number`;
    case 'date':
      return db`v.value_date`;
    case 'boolean':
      return db`v.value_bool`;
    default:
      return db`v.value_text`;
  }
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The predicate one filter puts on the entity column. */
export function fieldPredicate(
  db: SqlExecutor,
  field: Field,
  filter: FieldFilter,
  entity: SqlFragment,
): SqlFragment {
  if (!operatorsFor(field.kind).includes(filter.operator))
    throw new ValidationError(`${field.key} cannot be filtered with ${filter.operator}`);
  const row = (condition: SqlFragment) => db`exists (select 1 from custom_field_values v
    where v.field_id = ${field.id} and v.entity_id = ${entity} and ${condition})`;
  const column = columnOf(db, field);
  const value = filter.value;
  const list = Array.isArray(value) ? value : [String(value ?? '')];
  switch (filter.operator) {
    case 'is_empty':
      return db`not ${row(db`true`)}`;
    case 'is_not_empty':
      return row(db`true`);
    case 'in':
      return field.kind === 'multi_select'
        ? row(db`jsonb_exists_any(v.value, ${list}::text[])`)
        : row(db`${column} = any(${list}::text[])`);
    case 'contains':
      return row(db`${column} ilike ${`%${escapeLike(String(value ?? ''))}%`}`);
    case 'eq':
      return row(db`${column} = ${value as string}`);
    case 'neq':
      return db`not ${row(db`${column} = ${value as string}`)}`;
    case 'gt':
      return row(db`${column} > ${value as string}`);
    case 'gte':
      return row(db`${column} >= ${value as string}`);
    case 'lt':
      return row(db`${column} < ${value as string}`);
    case 'lte':
      return row(db`${column} <= ${value as string}`);
  }
}

/** An ORDER BY term for one field; entities with no value sort last either way. */
export function fieldOrder(db: SqlExecutor, field: Field, sort: FieldSort, entity: SqlFragment) {
  const column = columnOf(db, field);
  const value = db`(select ${column} from custom_field_values v
    where v.field_id = ${field.id} and v.entity_id = ${entity})`;
  return sort.direction === 'desc' ? db`${value} desc nulls last` : db`${value} asc nulls last`;
}

export interface CompiledQuery {
  /** `true` when there are no filters, so it always fits in a WHERE. */
  where: SqlFragment;
  /** A constant when there is no sort, so the module's own tie-breaker follows it. */
  orderBy: SqlFragment;
}

/**
 * Resolves keys against the scope's definitions and compiles. A field the actor may not see
 * cannot be filtered or sorted on, since the result would reveal its values.
 */
export async function compileFieldQuery(
  db: SqlExecutor,
  actor: Actor,
  scope: FieldScope,
  query: { filters?: readonly FieldFilter[]; sort?: readonly FieldSort[] },
  entity: SqlFragment,
): Promise<CompiledQuery> {
  const fields = await definitionsOf(db, scope);
  const roles = await viewerRoles(db, actor);
  const byKey = new Map(fields.filter((f) => allows(f.visibleTo, roles)).map((f) => [f.key, f]));
  const fieldOf = (key: string) => {
    const field = byKey.get(key);
    if (!field) throw new ValidationError(`There is no field ${key} to filter or sort on`);
    return field;
  };
  const filters = (query.filters ?? []).map((f) => fieldPredicate(db, fieldOf(f.field), f, entity));
  const sorts = (query.sort ?? []).map((s) => fieldOrder(db, fieldOf(s.field), s, entity));
  const join = (parts: SqlFragment[], separator: SqlFragment) =>
    parts.reduce((all, part) => db`${all} ${separator} ${part}`);
  return {
    where: filters.length > 0 ? join(filters, db`and`) : db`true`,
    orderBy: sorts.length > 0 ? join(sorts, db`,`) : db`(select null)`,
  };
}
