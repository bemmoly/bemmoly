import type { Token } from './tokenizer.ts';

/**
 * Where the cursor sits in the grammar. Autocomplete does not parse: a query
 * being typed is almost never valid, so a small state machine over the tokens
 * before the cursor decides what may come next.
 */
export type CursorState =
  | 'expression'
  | 'after-field'
  | 'after-operator'
  | 'after-is'
  | 'after-is-not'
  | 'after-not-field'
  | 'after-in'
  | 'in-list'
  | 'after-list-value'
  | 'after-condition'
  | 'after-order'
  | 'after-by'
  | 'after-order-field'
  | 'after-direction'
  | 'unknown';

export interface CursorContext {
  state: CursorState;
  /** The field of the condition being typed, as written, when the state has one. */
  field: string | undefined;
  /** The comparison operator of the condition being typed, when one was read. */
  operator: string | undefined;
  /** Open parentheses before the cursor, so `)` is offered only when it closes one. */
  depth: number;
}

const VALUE_KINDS: ReadonlySet<Token['kind']> = new Set([
  'word',
  'string',
  'number',
  'date',
  'duration',
  'function',
]);

function isValue(token: Token): boolean {
  return VALUE_KINDS.has(token.kind) || (token.kind === 'keyword' && token.value === 'EMPTY');
}

function isField(token: Token): boolean {
  return token.kind === 'word' || token.kind === 'string';
}

function fieldName(token: Token): string {
  return token.kind === 'string' ? token.value : token.text;
}

function keyword(token: Token): string | undefined {
  return token.kind === 'keyword' ? token.value : undefined;
}

function step(context: CursorContext, token: Token): CursorContext {
  const word = keyword(token);
  const next = (
    state: CursorContext['state'],
    patch: Partial<CursorContext> = {},
  ): CursorContext => ({
    ...context,
    ...patch,
    state,
  });

  switch (context.state) {
    case 'expression':
      if (isField(token))
        return next('after-field', { field: fieldName(token), operator: undefined });
      if (word === 'NOT') return next('expression');
      if (word === 'ORDER' && context.depth === 0) return next('after-order');
      if (token.kind === 'lparen') return next('expression', { depth: context.depth + 1 });
      break;
    case 'after-field':
      if (token.kind === 'operator') return next('after-operator', { operator: token.text });
      if (word === 'IS') return next('after-is');
      if (word === 'NOT') return next('after-not-field');
      if (word === 'IN') return next('after-in');
      break;
    case 'after-operator':
      if (isValue(token)) return next('after-condition');
      break;
    case 'after-is':
      if (word === 'EMPTY') return next('after-condition');
      if (word === 'NOT') return next('after-is-not');
      break;
    case 'after-is-not':
      if (word === 'EMPTY') return next('after-condition');
      break;
    case 'after-not-field':
      if (word === 'IN') return next('after-in');
      break;
    case 'after-in':
      if (token.kind === 'lparen') return next('in-list');
      break;
    case 'in-list':
      if (isValue(token)) return next('after-list-value');
      break;
    case 'after-list-value':
      if (token.kind === 'comma') return next('in-list');
      if (token.kind === 'rparen') return next('after-condition');
      break;
    case 'after-condition':
      if (word === 'AND' || word === 'OR')
        return next('expression', { field: undefined, operator: undefined });
      if (word === 'ORDER' && context.depth === 0) return next('after-order');
      if (token.kind === 'rparen' && context.depth > 0)
        return next('after-condition', { depth: context.depth - 1 });
      break;
    case 'after-order':
      if (word === 'BY') return next('after-by');
      break;
    case 'after-by':
      if (isField(token)) return next('after-order-field', { field: fieldName(token) });
      break;
    case 'after-order-field':
      if (word === 'ASC' || word === 'DESC') return next('after-direction');
      if (token.kind === 'comma') return next('after-by');
      break;
    case 'after-direction':
      if (token.kind === 'comma') return next('after-by');
      break;
    case 'unknown':
      break;
  }
  return next('unknown');
}

/** Folds the tokens before the cursor (without the trailing `eof`) into a cursor context. */
export function readCursorContext(tokens: readonly Token[]): CursorContext {
  let context: CursorContext = {
    state: 'expression',
    field: undefined,
    operator: undefined,
    depth: 0,
  };
  for (const token of tokens) {
    if (token.kind === 'eof') break;
    context = step(context, token);
    if (context.state === 'unknown') break;
  }
  return context;
}
