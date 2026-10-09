import {
  COMPARISON_OPERATORS,
  spanBetween,
  type ComparisonOperator,
  type Expression,
  type FieldRef,
  type OrderBy,
  type Query,
  type Span,
  type Value,
} from './ast.ts';
import type { LqlError, LqlResult } from './errors.ts';
import { tokenize, unexpectedToken, type Keyword, type Token } from './tokenizer.ts';

export type ParseResult = LqlResult<Query>;

const VALUE_EXPECTED = ['a value'];
const FIELD_EXPECTED = ['a field'];
const OPERATOR_EXPECTED = [...COMPARISON_OPERATORS, 'IN', 'NOT IN', 'IS EMPTY', 'IS NOT EMPTY'];

/** Thrown inside the parser only; `parseLql` turns it into a result. */
class ParseFailure {
  readonly error: LqlError;

  constructor(error: LqlError) {
    this.error = error;
  }
}

function fail(token: Token, expected: string[]): never {
  throw new ParseFailure(unexpectedToken(token, expected));
}

/**
 * Recursive descent with the usual precedence: NOT binds tightest, then AND,
 * then OR. AND and OR chains are flattened into one n-ary node so the
 * formatter prints `a AND b AND c` without inventing parentheses.
 */
class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseQuery(): Query {
    const first = this.peek();
    const where =
      this.atKeyword('ORDER') || this.peek().kind === 'eof' ? undefined : this.parseOr();
    const orderBy = this.parseOrderBy();
    const last = this.peek();
    if (last.kind !== 'eof') {
      fail(last, where === undefined ? FIELD_EXPECTED : ['AND', 'OR', 'ORDER BY']);
    }
    return { where, orderBy, span: spanBetween(first.span, last.span) };
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)] as Token;
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== 'eof') this.index += 1;
    return token;
  }

  private atKeyword(value: Keyword, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'keyword' && token.value === value;
  }

  private expectKeyword(value: Keyword): Token {
    if (!this.atKeyword(value)) fail(this.peek(), [value]);
    return this.next();
  }

  private parseOr(): Expression {
    const operands = [this.parseAnd()];
    while (this.atKeyword('OR')) {
      this.next();
      operands.push(this.parseAnd());
    }
    return operands.length === 1 ? (operands[0] as Expression) : this.combine('or', operands);
  }

  private parseAnd(): Expression {
    const operands = [this.parseNot()];
    while (this.atKeyword('AND')) {
      this.next();
      operands.push(this.parseNot());
    }
    return operands.length === 1 ? (operands[0] as Expression) : this.combine('and', operands);
  }

  private combine(kind: 'and' | 'or', operands: Expression[]): Expression {
    const first = operands[0] as Expression;
    const last = operands[operands.length - 1] as Expression;
    return { kind, operands, span: spanBetween(first.span, last.span) };
  }

  private parseNot(): Expression {
    if (this.atKeyword('NOT')) {
      const not = this.next();
      const operand = this.parseNot();
      return { kind: 'not', operand, span: spanBetween(not.span, operand.span) };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.peek();
    if (token.kind === 'lparen') {
      this.next();
      const inner = this.parseOr();
      if (this.peek().kind !== 'rparen') fail(this.peek(), [')', 'AND', 'OR']);
      const close = this.next();
      return { ...inner, span: spanBetween(token.span, close.span) };
    }
    return this.parseCondition();
  }

  private parseField(): FieldRef {
    const token = this.peek();
    if (token.kind === 'word') {
      this.next();
      return { name: token.text, quoted: false, span: token.span };
    }
    if (token.kind === 'string') {
      this.next();
      return { name: token.value, quoted: true, span: token.span };
    }
    return fail(token, FIELD_EXPECTED);
  }

  private parseCondition(): Expression {
    const field = this.parseField();
    const token = this.peek();

    if (token.kind === 'operator') {
      this.next();
      const operator = token.text as ComparisonOperator;
      if (this.atKeyword('EMPTY') && (operator === '=' || operator === '!=')) {
        const empty = this.next();
        return {
          kind: 'empty',
          field,
          negated: operator === '!=',
          span: spanBetween(field.span, empty.span),
        };
      }
      const value = this.parseValue();
      return {
        kind: 'comparison',
        field,
        operator,
        value,
        span: spanBetween(field.span, value.span),
      };
    }

    if (this.atKeyword('IS')) {
      this.next();
      const negated = this.atKeyword('NOT');
      if (negated) this.next();
      const empty = this.expectKeyword('EMPTY');
      return { kind: 'empty', field, negated, span: spanBetween(field.span, empty.span) };
    }

    if (this.atKeyword('IN') || (this.atKeyword('NOT') && this.atKeyword('IN', 1))) {
      const negated = this.atKeyword('NOT');
      if (negated) this.next();
      this.next();
      const { values, span } = this.parseList();
      return {
        kind: 'membership',
        field,
        operator: negated ? 'NOT IN' : 'IN',
        values,
        span: spanBetween(field.span, span),
      };
    }

    return fail(token, OPERATOR_EXPECTED);
  }

  private parseList(): { values: Value[]; span: Span } {
    if (this.peek().kind !== 'lparen') fail(this.peek(), ['(']);
    this.next();
    const values = [this.parseValue()];
    while (this.peek().kind === 'comma') {
      this.next();
      values.push(this.parseValue());
    }
    if (this.peek().kind !== 'rparen') fail(this.peek(), [',', ')']);
    return { values, span: this.next().span };
  }

  private parseValue(): Value {
    const token = this.next();
    const span = token.span;
    switch (token.kind) {
      case 'string':
        return { kind: 'string', value: token.value, quoted: true, span };
      case 'word':
        return token.text === 'me'
          ? { kind: 'me', span }
          : { kind: 'string', value: token.text, quoted: false, span };
      case 'number':
        return { kind: 'number', value: token.value, span };
      case 'date':
        return { kind: 'date', value: token.text, span };
      case 'duration':
        return { kind: 'duration', amount: token.amount, unit: token.unit, span };
      case 'function':
        return { kind: 'function', name: token.value, span };
      default:
        return fail(token, VALUE_EXPECTED);
    }
  }

  private parseOrderBy(): OrderBy[] {
    if (!this.atKeyword('ORDER')) return [];
    this.next();
    this.expectKeyword('BY');
    const items: OrderBy[] = [];
    do {
      const field = this.parseField();
      let direction: OrderBy['direction'];
      let span = field.span;
      if (this.atKeyword('ASC') || this.atKeyword('DESC')) {
        const token = this.next();
        direction = (token as { value: 'ASC' | 'DESC' }).value;
        span = spanBetween(field.span, token.span);
      }
      items.push({ field, direction, span });
    } while (this.peek().kind === 'comma' && this.next());
    return items;
  }
}

/** Parses query text. User mistakes come back as a positioned error, never an exception. */
export function parseLql(text: string): ParseResult {
  const tokens = tokenize(text);
  if (!tokens.ok) return tokens;
  try {
    return { ok: true, value: new Parser(tokens.value).parseQuery() };
  } catch (failure) {
    if (failure instanceof ParseFailure) return { ok: false, error: failure.error };
    throw failure;
  }
}
