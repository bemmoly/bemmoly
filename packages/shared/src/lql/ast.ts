/**
 * The syntax tree the parser produces and the module compiles to SQL.
 *
 * Every node carries the span of source text it came from so the validator can
 * point at the exact field, operator or value it rejects, and so the filter bar
 * can underline it without re-parsing.
 */
export interface Span {
  /** Zero-based character offset into the query text. */
  position: number;
  length: number;
}

export const COMPARISON_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', '~', '!~'] as const;

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

export const LIST_OPERATORS = ['IN', 'NOT IN'] as const;

export type ListOperator = (typeof LIST_OPERATORS)[number];

export const EMPTY_OPERATORS = ['IS EMPTY', 'IS NOT EMPTY'] as const;

export type EmptyOperator = (typeof EMPTY_OPERATORS)[number];

export type LqlOperator = ComparisonOperator | ListOperator | EmptyOperator;

export const DURATION_UNITS = ['h', 'd', 'w'] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number];

/**
 * A field is named either bare (`status`, `cf.spec_doc`) or quoted (`"spec doc"`)
 * when its label has characters the tokenizer would split on. The catalog
 * resolves either form; the AST keeps the spelling so formatting round-trips.
 */
export interface FieldRef {
  name: string;
  quoted: boolean;
  span: Span;
}

export type Value =
  /** A bare word or a quoted string; `quoted` matters only for formatting. */
  | { kind: 'string'; value: string; quoted: boolean; span: Span }
  | { kind: 'number'; value: number; span: Span }
  /** An ISO date or date-time literal, kept as written. */
  | { kind: 'date'; value: string; span: Span }
  /** A signed offset from now, such as `-7d` or `+2w`. */
  | { kind: 'duration'; amount: number; unit: DurationUnit; span: Span }
  /** A zero-argument function such as `now()` or `currentSprint()`. */
  | { kind: 'function'; name: string; span: Span }
  /** The signed-in person, written bare as `me`. */
  | { kind: 'me'; span: Span };

export type Expression =
  | { kind: 'comparison'; field: FieldRef; operator: ComparisonOperator; value: Value; span: Span }
  | { kind: 'membership'; field: FieldRef; operator: ListOperator; values: Value[]; span: Span }
  | { kind: 'empty'; field: FieldRef; negated: boolean; span: Span }
  | { kind: 'and'; operands: Expression[]; span: Span }
  | { kind: 'or'; operands: Expression[]; span: Span }
  | { kind: 'not'; operand: Expression; span: Span };

export type SortDirection = 'ASC' | 'DESC';

export interface OrderBy {
  field: FieldRef;
  /** Undefined when the query left the direction to the default. */
  direction: SortDirection | undefined;
  span: Span;
}

export interface Query {
  /** Undefined for a query that only orders, or for empty text. */
  where: Expression | undefined;
  orderBy: OrderBy[];
  span: Span;
}

export function spanBetween(first: Span, last: Span): Span {
  return { position: first.position, length: last.position + last.length - first.position };
}
