import type { Expression, FieldRef, LqlOperator, Query, Value } from './ast.ts';
import type { LqlError } from './errors.ts';
import { DATE_FUNCTIONS, type LqlField, type LqlFieldCatalog } from './fields.ts';

const dateFunctions = new Set<string>(DATE_FUNCTIONS);

function describe(value: Value): string {
  switch (value.kind) {
    case 'string':
      return `"${value.value}"`;
    case 'number':
      return String(value.value);
    case 'date':
      return value.value;
    case 'duration':
      return `${value.amount}${value.unit}`;
    case 'function':
      return `${value.name}()`;
    case 'me':
      return 'me';
  }
}

function fieldError(ref: FieldRef, catalog: LqlFieldCatalog): LqlError {
  return {
    message: `Unknown field "${ref.name}"`,
    position: ref.span.position,
    length: ref.span.length,
    expected: catalog.fields.map((field) => field.key),
  };
}

function operatorError(
  ref: FieldRef,
  field: LqlField,
  operator: LqlOperator,
  span: Expression['span'],
): LqlError {
  return {
    message: `${field.label} does not support ${operator}`,
    position: ref.span.position,
    length: span.length,
    expected: [...field.operators],
  };
}

function valueError(value: Value, message: string, expected?: string[]): LqlError {
  const error: LqlError = { message, position: value.span.position, length: value.span.length };
  return expected ? { ...error, expected } : error;
}

/**
 * Whether a value fits a field's kind. A function is accepted only where the
 * field lists it, except date functions, which every date field takes.
 */
function checkValue(field: LqlField, value: Value): LqlError | undefined {
  if (value.kind === 'function') {
    const allowed =
      field.functions?.includes(value.name) ||
      (field.kind === 'date' && dateFunctions.has(value.name));
    return allowed
      ? undefined
      : valueError(
          value,
          `${field.label} does not take ${value.name}()`,
          field.functions ? [...field.functions] : undefined,
        );
  }
  if (value.kind === 'me') {
    return field.kind === 'user'
      ? undefined
      : valueError(value, `${field.label} is not a person, so "me" has no meaning here`);
  }
  switch (field.kind) {
    case 'number':
      return value.kind === 'number'
        ? undefined
        : valueError(value, `${field.label} needs a number, not ${describe(value)}`);
    case 'date':
      if (value.kind === 'date' || value.kind === 'duration') return undefined;
      if (value.kind === 'string' && !Number.isNaN(Date.parse(value.value))) return undefined;
      return valueError(
        value,
        `${field.label} needs a date such as 2026-01-31 or -7d, not ${describe(value)}`,
      );
    case 'enum':
      if (field.options && value.kind === 'string') {
        const match = field.options.some(
          (option) => option.toLowerCase() === value.value.toLowerCase(),
        );
        return match
          ? undefined
          : valueError(value, `${describe(value)} is not a ${field.label.toLowerCase()}`, [
              ...field.options,
            ]);
      }
      return value.kind === 'string'
        ? undefined
        : valueError(value, `${field.label} needs a name, not ${describe(value)}`);
    case 'text':
    case 'user':
    case 'key':
      return value.kind === 'string'
        ? undefined
        : valueError(value, `${field.label} needs text, not ${describe(value)}`);
    case 'option':
      return value.kind === 'string' || value.kind === 'number'
        ? undefined
        : valueError(value, `${field.label} needs a name, not ${describe(value)}`);
  }
}

function checkExpression(
  expression: Expression,
  catalog: LqlFieldCatalog,
  errors: LqlError[],
): void {
  switch (expression.kind) {
    case 'and':
    case 'or':
      for (const operand of expression.operands) checkExpression(operand, catalog, errors);
      return;
    case 'not':
      checkExpression(expression.operand, catalog, errors);
      return;
    case 'comparison':
    case 'membership':
    case 'empty':
      break;
  }

  const field = catalog.resolve(expression.field.name);
  if (!field) {
    errors.push(fieldError(expression.field, catalog));
    return;
  }
  const operator: LqlOperator =
    expression.kind === 'empty'
      ? expression.negated
        ? 'IS NOT EMPTY'
        : 'IS EMPTY'
      : expression.operator;
  if (!field.operators.includes(operator)) {
    errors.push(operatorError(expression.field, field, operator, expression.span));
    return;
  }
  const values =
    expression.kind === 'comparison'
      ? [expression.value]
      : expression.kind === 'membership'
        ? expression.values
        : [];
  for (const value of values) {
    const error = checkValue(field, value);
    if (error) errors.push(error);
  }
}

/**
 * Checks a parsed query against a catalog: every field exists, every operator
 * is one the field takes and every value fits the field's kind. All problems
 * are returned at once so the filter bar can underline each of them.
 */
export function validateLql(query: Query, catalog: LqlFieldCatalog): LqlError[] {
  const errors: LqlError[] = [];
  if (query.where) checkExpression(query.where, catalog, errors);
  for (const item of query.orderBy) {
    if (!catalog.resolve(item.field.name)) errors.push(fieldError(item.field, catalog));
  }
  return errors;
}
