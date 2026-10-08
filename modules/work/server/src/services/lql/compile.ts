import type { SqlClient, SqlFragment } from '@bemmoly/core';
import {
  ValidationError,
  type Expression,
  type LqlField,
  type LqlFieldCatalog,
  type LqlFieldKind,
  type Query,
  type SortDirection,
} from '@bemmoly/shared';
import { customFieldCompiler, customKeyOf, type CustomFieldDefinition } from './custom.ts';
import { builtInFields, type FieldCompiler } from './fields.ts';
import { joinWith, type ValueContext } from './values.ts';

/**
 * A field catalog that also remembers how each custom field is stored. The
 * shared catalog is what the parser and validator see; the storage kinds are
 * what the cast needs. A plain catalog still compiles, with the cast guessed
 * from the field's query kind.
 */
export interface CompileCatalog extends LqlFieldCatalog {
  custom?: ReadonlyMap<string, CustomFieldDefinition>;
}

export interface Compiled {
  where: SqlFragment;
  /** The full ORDER BY list, ending in the id tiebreak. */
  orderBy: SqlFragment;
  /** One direction per sort key, the tiebreak included, for keyset paging. */
  directions: SortDirection[];
  /** The sort expressions without direction, the tiebreak included. */
  sortKeys: SqlFragment[];
}

const STORAGE_OF_KIND: Partial<Record<LqlFieldKind, CustomFieldDefinition['storage']>> = {
  text: 'text',
  number: 'number',
  date: 'datetime',
  user: 'user',
  option: 'select',
};

function compilerFor(
  field: LqlField,
  catalog: CompileCatalog,
  builtIns: Record<string, FieldCompiler>,
): FieldCompiler {
  const custom = customKeyOf(field.key);
  if (custom === undefined) {
    const compiler = builtIns[field.key];
    if (!compiler) {
      throw new ValidationError(`${field.label} cannot be queried`, { code: 'bad_request' });
    }
    return compiler;
  }
  const definition = catalog.custom?.get(custom) ?? {
    key: custom,
    label: field.label,
    kind: field.kind,
    storage: STORAGE_OF_KIND[field.kind] ?? 'text',
  };
  return customFieldCompiler(definition);
}

function resolve(
  name: string,
  catalog: CompileCatalog,
  builtIns: Record<string, FieldCompiler>,
): FieldCompiler {
  const field = catalog.resolve(name);
  if (!field) throw new ValidationError(`Unknown field "${name}"`, { code: 'bad_request' });
  return compilerFor(field, catalog, builtIns);
}

function compileExpression(
  sql: SqlClient,
  expression: Expression,
  catalog: CompileCatalog,
  builtIns: Record<string, FieldCompiler>,
  cx: ValueContext,
): SqlFragment {
  const recurse = (operand: Expression) => compileExpression(sql, operand, catalog, builtIns, cx);
  switch (expression.kind) {
    case 'and':
    case 'or':
      return joinWith(sql, expression.operands.map(recurse), expression.kind);
    case 'not':
      return sql`not ${recurse(expression.operand)}`;
    case 'comparison':
      return sql`(${resolve(expression.field.name, catalog, builtIns).predicate(
        sql,
        expression.operator,
        [expression.value],
        cx,
      )})`;
    case 'membership':
      return sql`(${resolve(expression.field.name, catalog, builtIns).predicate(
        sql,
        expression.operator,
        expression.values,
        cx,
      )})`;
    case 'empty':
      return sql`(${resolve(expression.field.name, catalog, builtIns).predicate(
        sql,
        expression.negated ? 'IS NOT EMPTY' : 'IS EMPTY',
        [],
        cx,
      )})`;
  }
}

/** Compiles the WHERE part alone, for callers that embed it in their own statement. */
export function compileWhere(
  sql: SqlClient,
  query: Query,
  catalog: CompileCatalog,
  cx: ValueContext,
): SqlFragment {
  if (!query.where) return sql`true`;
  return compileExpression(sql, query.where, catalog, builtInFields(sql), cx);
}

/**
 * Compiles a validated query. Without ORDER BY the list keeps its board
 * order (rank); with one, the id tiebreak is appended so paging is stable
 * even where many rows share a sort value.
 */
export function compileQuery(
  sql: SqlClient,
  query: Query,
  catalog: CompileCatalog,
  cx: ValueContext,
): Compiled {
  const builtIns = builtInFields(sql);
  const keys = query.orderBy.map((item) => ({
    expression: resolve(item.field.name, catalog, builtIns).sort(sql),
    direction: item.direction ?? 'ASC',
  }));
  if (keys.length === 0) keys.push({ expression: sql`issues.rank`, direction: 'ASC' });
  const last = keys[keys.length - 1]?.direction ?? 'ASC';
  keys.push({ expression: sql`issues.id`, direction: last });
  const orderBy = keys
    .map(({ expression, direction }) =>
      direction === 'DESC' ? sql`${expression} desc nulls last` : sql`${expression} asc nulls last`,
    )
    .reduce((acc, part) => sql`${acc}, ${part}`);
  return {
    where: compileWhere(sql, query, catalog, cx),
    orderBy,
    directions: keys.map((key) => key.direction),
    sortKeys: keys.map((key) => key.expression),
  };
}
