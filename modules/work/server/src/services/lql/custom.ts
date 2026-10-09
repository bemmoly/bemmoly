import type { SqlClient, SqlFragment } from '@bemmoly/core';
import {
  CUSTOM_FIELD_PREFIX,
  type CustomFieldSpec,
  type LqlFieldKind,
  type LqlOperator,
  type Value,
} from '@bemmoly/shared';
import type { FieldKind } from '../../../../shared/enums.ts';
import type { FieldCompiler } from './fields.ts';
import { datePredicate, existsPredicate, numberPredicate, textPredicate } from './predicates.ts';
import { meOf, textOf, type ValueContext } from './values.ts';

/*
 * Custom field values live in issues.custom_fields; the field definition's
 * kind decides the JSONB path's cast, as tech design §14 says. The key is a
 * parameter, so a field named like a SQL keyword is just another path.
 */

/** How each definition kind queries, from the catalog's point of view. */
export const LQL_KIND_OF: Record<FieldKind, LqlFieldKind> = {
  text: 'text',
  richtext: 'text',
  url: 'text',
  doc: 'text',
  number: 'number',
  select: 'option',
  multiselect: 'option',
  user: 'user',
  date: 'date',
  datetime: 'date',
};

export interface CustomFieldDefinition extends CustomFieldSpec {
  /** The definition's own kind, which picks the cast; `kind` is what the catalog sees. */
  storage: FieldKind;
}

/** A JSON null is as empty as a missing key. */
const present = (sql: SqlClient, key: string) =>
  sql`nullif(issues.custom_fields -> ${key}, 'null'::jsonb)`;

function userPredicate(
  sql: SqlClient,
  key: string,
  operator: LqlOperator,
  values: Value[],
  cx: ValueContext,
): SqlFragment {
  const ids = values.map((value) => (value.kind === 'me' ? meOf(cx) : textOf(value)));
  const column = sql`issues.custom_fields ->> ${key}`;
  switch (operator) {
    case '=':
    case 'IN':
      return sql`${column} = any(${ids}::text[])`;
    case '!=':
    case 'NOT IN':
      return sql`${column} <> all(${ids}::text[])`;
    case 'IS EMPTY':
      return sql`${present(sql, key)} is null`;
    case 'IS NOT EMPTY':
      return sql`${present(sql, key)} is not null`;
    default:
      return textPredicate(sql, column, operator, values);
  }
}

/** A multiselect holds a JSON array; membership is containment of any value. */
function multiPredicate(
  sql: SqlClient,
  key: string,
  operator: LqlOperator,
  values: Value[],
): SqlFragment {
  const names = values.map(textOf);
  const matching = sql`select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(issues.custom_fields -> ${key}) = 'array'
        then issues.custom_fields -> ${key} else '[]'::jsonb end) as v(value)
    where v.value = any(${names}::text[])`;
  const any = sql`select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(issues.custom_fields -> ${key}) = 'array'
        then issues.custom_fields -> ${key} else '[]'::jsonb end) as v(value)`;
  return existsPredicate(sql, operator, matching, any);
}

export function customFieldCompiler(definition: CustomFieldDefinition): FieldCompiler {
  const { key, storage } = definition;
  switch (storage) {
    case 'number':
      return {
        predicate: (sql, operator, values) =>
          numberPredicate(sql, sql`(issues.custom_fields ->> ${key})::numeric`, operator, values),
        sort: (sql) => sql`(issues.custom_fields ->> ${key})::numeric`,
      };
    case 'date':
    case 'datetime':
      return {
        predicate: (sql, operator, values, cx) =>
          datePredicate(
            sql,
            sql`(issues.custom_fields ->> ${key})::timestamptz`,
            operator,
            values,
            cx,
          ),
        sort: (sql) => sql`(issues.custom_fields ->> ${key})::timestamptz`,
      };
    case 'user':
      return {
        predicate: (sql, operator, values, cx) => userPredicate(sql, key, operator, values, cx),
        sort: (sql) =>
          sql`(select name from users where id::text = issues.custom_fields ->> ${key})`,
      };
    case 'multiselect':
      return {
        predicate: (sql, operator, values) => multiPredicate(sql, key, operator, values),
        sort: (sql) => sql`issues.custom_fields ->> ${key}`,
      };
    default:
      return {
        predicate: (sql, operator, values) =>
          textPredicate(sql, sql`issues.custom_fields ->> ${key}`, operator, values),
        sort: (sql) => sql`issues.custom_fields ->> ${key}`,
      };
  }
}

/** The compiler for a `cf.<key>` reference, or undefined when the name is a built-in. */
export function customKeyOf(name: string): string | undefined {
  return name.startsWith(CUSTOM_FIELD_PREFIX) ? name.slice(CUSTOM_FIELD_PREFIX.length) : undefined;
}
