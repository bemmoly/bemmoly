import { describe, expect, it } from 'vitest';
import type { Expression, Query } from './ast.ts';
import { parseLql } from './parser.ts';

function parse(text: string): Query {
  const result = parseLql(text);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function where(text: string): Expression {
  const query = parse(text);
  if (!query.where) throw new Error('No where clause');
  return query.where;
}

describe('parseLql', () => {
  it('parses the query from the tech design', () => {
    const query = parse(
      'project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC',
    );
    expect(query.where).toMatchObject({
      kind: 'and',
      operands: [
        {
          kind: 'comparison',
          field: { name: 'project' },
          operator: '=',
          value: { kind: 'string', value: 'PLT' },
        },
        {
          kind: 'comparison',
          field: { name: 'status' },
          operator: '!=',
          value: { kind: 'string', value: 'Done' },
        },
        { kind: 'comparison', field: { name: 'assignee' }, operator: '=', value: { kind: 'me' } },
        { kind: 'empty', field: { name: 'spec doc', quoted: true }, negated: false },
      ],
    });
    expect(query.orderBy).toMatchObject([{ field: { name: 'updated' }, direction: 'DESC' }]);
  });

  it.each([
    ['priority = Highest', { kind: 'comparison', operator: '=' }],
    ['type = Bug AND label = customer', { kind: 'and' }],
    ['label = tech-debt', { kind: 'comparison', value: { value: 'tech-debt' } }],
  ])('parses the swimlane query %s from the board settings mock', (text, shape) => {
    expect(where(text)).toMatchObject(shape);
  });

  it('binds NOT tighter than AND, and AND tighter than OR', () => {
    expect(where('NOT a = 1 AND b = 2 OR c = 3')).toMatchObject({
      kind: 'or',
      operands: [
        {
          kind: 'and',
          operands: [{ kind: 'not', operand: { kind: 'comparison' } }, { kind: 'comparison' }],
        },
        { kind: 'comparison' },
      ],
    });
  });

  it('lets parentheses override precedence and keeps their span', () => {
    const expression = where('a = 1 AND (b = 2 OR c = 3)');
    expect(expression).toMatchObject({
      kind: 'and',
      operands: [{ kind: 'comparison' }, { kind: 'or', span: { position: 10, length: 16 } }],
    });
  });

  it('flattens chains of the same operator', () => {
    const expression = where('a = 1 AND b = 2 AND c = 3');
    expect(expression.kind).toBe('and');
    expect(expression.kind === 'and' && expression.operands).toHaveLength(3);
  });

  it('parses membership with either spelling of the negation', () => {
    expect(where('status IN (Done, "In review", 3)')).toMatchObject({
      kind: 'membership',
      operator: 'IN',
      values: [
        { kind: 'string', value: 'Done' },
        { kind: 'string', value: 'In review' },
        { kind: 'number', value: 3 },
      ],
    });
    expect(where('status NOT IN (Done)')).toMatchObject({ kind: 'membership', operator: 'NOT IN' });
  });

  it('reads every spelling of an empty check', () => {
    expect(where('assignee IS EMPTY')).toMatchObject({ kind: 'empty', negated: false });
    expect(where('assignee IS NOT EMPTY')).toMatchObject({ kind: 'empty', negated: true });
    expect(where('assignee = EMPTY')).toMatchObject({ kind: 'empty', negated: false });
    expect(where('assignee != EMPTY')).toMatchObject({ kind: 'empty', negated: true });
  });

  it('parses date literals, durations and functions as values', () => {
    expect(where('due <= 2026-01-31')).toMatchObject({
      value: { kind: 'date', value: '2026-01-31' },
    });
    expect(where('updated >= -7d')).toMatchObject({
      value: { kind: 'duration', amount: -7, unit: 'd' },
    });
    expect(where('created < startOfWeek()')).toMatchObject({
      value: { kind: 'function', name: 'startOfWeek' },
    });
    expect(where('sprint = currentSprint()')).toMatchObject({
      value: { kind: 'function', name: 'currentSprint' },
    });
  });

  it('accepts an order clause on its own and several sort keys', () => {
    const query = parse('ORDER BY priority, updated DESC, "spec doc" ASC');
    expect(query.where).toBeUndefined();
    expect(query.orderBy).toMatchObject([
      { field: { name: 'priority' }, direction: undefined },
      { field: { name: 'updated' }, direction: 'DESC' },
      { field: { name: 'spec doc', quoted: true }, direction: 'ASC' },
    ]);
  });

  it('parses empty text as a query with nothing in it', () => {
    expect(parse('')).toEqual({ where: undefined, orderBy: [], span: { position: 0, length: 0 } });
  });

  it.each([
    ['status =', 'Unexpected end of query, expected a value', 8, 0, ['a value']],
    [
      'status',
      'Unexpected end of query, expected = or != or < or <= or > or >= or ~ or !~ or IN or NOT IN or IS EMPTY or IS NOT EMPTY',
      6,
      0,
      undefined,
    ],
    ['status = Done AND', 'Unexpected end of query, expected a field', 17, 0, ['a field']],
    [
      'status = Done Done',
      'Unexpected "Done", expected AND or OR or ORDER BY',
      14,
      4,
      ['AND', 'OR', 'ORDER BY'],
    ],
    ['status IN Done', 'Unexpected "Done", expected (', 10, 4, ['(']],
    ['status IN (Done', 'Unexpected end of query, expected , or )', 15, 0, [',', ')']],
    [
      '(status = Done',
      'Unexpected end of query, expected ) or AND or OR',
      14,
      0,
      [')', 'AND', 'OR'],
    ],
    ['assignee IS Done', 'Unexpected "Done", expected EMPTY', 12, 4, ['EMPTY']],
    ['ORDER updated', 'Unexpected "updated", expected BY', 6, 7, ['BY']],
    ['= Done', 'Unexpected "=", expected a field', 0, 1, ['a field']],
    ['summary ~ "open', 'Missing closing quote', 10, 5, ['"']],
  ])('reports %s at the offending token', (text, message, position, length, expected) => {
    const result = parseLql(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ message, position, length });
    if (expected) expect(result.error.expected).toEqual(expected);
  });

  it('spans each node over the text it came from', () => {
    const expression = where('status = Done AND assignee IS EMPTY');
    expect(expression.span).toEqual({ position: 0, length: 35 });
    expect(expression.kind === 'and' && expression.operands[1]?.span).toEqual({
      position: 18,
      length: 17,
    });
  });
});
