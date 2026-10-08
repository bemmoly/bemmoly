import type { Expression, FieldRef, Query, Value } from './ast.ts';
import { isKeyword } from './tokenizer.ts';

const BARE = /^[A-Za-z_][\w.-]*$/;

function quote(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/**
 * A name stays bare only when the tokenizer would read it back as one word
 * that is not a keyword, a number or a date; everything else is quoted.
 */
function needsQuotes(text: string): boolean {
  return !BARE.test(text) || isKeyword(text) || text === 'me' || /^\d/.test(text);
}

/** A field name or value as the tokenizer will read it back: bare when it can be, quoted otherwise. */
export function formatName(text: string): string {
  return needsQuotes(text) ? quote(text) : text;
}

function formatField(field: FieldRef): string {
  return formatName(field.name);
}

export function formatValue(value: Value): string {
  switch (value.kind) {
    case 'string':
      return formatName(value.value);
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

const PRECEDENCE: Record<Expression['kind'], number> = {
  or: 1,
  and: 2,
  not: 3,
  comparison: 4,
  membership: 4,
  empty: 4,
};

/** Parentheses appear only where the operand binds looser than its parent. */
function formatOperand(operand: Expression, parent: Expression['kind']): string {
  const text = formatExpression(operand);
  return PRECEDENCE[operand.kind] < PRECEDENCE[parent] ? `(${text})` : text;
}

export function formatExpression(expression: Expression): string {
  switch (expression.kind) {
    case 'comparison':
      return `${formatField(expression.field)} ${expression.operator} ${formatValue(expression.value)}`;
    case 'membership':
      return `${formatField(expression.field)} ${expression.operator} (${expression.values.map(formatValue).join(', ')})`;
    case 'empty':
      return `${formatField(expression.field)} ${expression.negated ? 'IS NOT EMPTY' : 'IS EMPTY'}`;
    case 'and':
    case 'or':
      return expression.operands
        .map((operand) => formatOperand(operand, expression.kind))
        .join(expression.kind === 'and' ? ' AND ' : ' OR ');
    case 'not':
      return `NOT ${formatOperand(expression.operand, 'not')}`;
  }
}

/**
 * Prints a query in canonical form: upper-case keywords, one space around
 * operators, `IS EMPTY` for every spelling of an empty check, quotes only where
 * needed. Saved filters are stored this way and the AI shows it before running.
 */
export function formatLql(query: Query): string {
  const parts: string[] = [];
  if (query.where) parts.push(formatExpression(query.where));
  if (query.orderBy.length > 0) {
    const items = query.orderBy.map((item) =>
      item.direction ? `${formatField(item.field)} ${item.direction}` : formatField(item.field),
    );
    parts.push(`ORDER BY ${items.join(', ')}`);
  }
  return parts.join(' ');
}
