import type { CardColorRuleEntry } from '@bemmoly/module-work/shared';
import {
  createIssueFieldCatalog,
  parseLql,
  validateLql,
  type Expression,
  type Value,
} from '@bemmoly/shared';
import type { ViewCard } from './board-model.ts';

/*
 * The board's colour rules, evaluated on the cards already loaded: the first rule whose LQL
 * condition matches a card paints it. The shared package parses and validates; this answers
 * the fields a card carries (key, type, status, status category, priority, assignee, label,
 * epic or parent, estimate, due, text). A rule that names any other field matches no card
 * here, since the view does not carry that field.
 */

export interface RuleNames {
  meId: string | undefined;
  statusName(id: string): string | undefined;
  statusCategory(id: string): string | undefined;
  typeName(id: string): string | undefined;
  userName(id: string): string | undefined;
  labelName(id: string): string | undefined;
  issueKey(id: string): string | undefined;
}

type Values = Array<string | number> | null;

const catalog = createIssueFieldCatalog();
const HOUR = 3_600_000;
const UNIT = { h: HOUR, d: 24 * HOUR, w: 7 * 24 * HOUR } as const;
const lower = (text: string | undefined | null): Values => (text ? [text.toLowerCase()] : []);

/** What the card holds for a field; null when the card cannot answer it. */
function valuesOf(field: string, card: ViewCard, names: RuleNames): Values {
  switch (field) {
    case 'key':
      return lower(card.key);
    case 'type':
      return lower(names.typeName(card.typeId));
    case 'status':
      return lower(names.statusName(card.statusId));
    case 'statusCategory':
      return lower(names.statusCategory(card.statusId));
    case 'priority':
      return lower(card.priority);
    case 'assignee':
      return card.assigneeId ? lower(names.userName(card.assigneeId)) : [];
    case 'label':
      return card.labelIds.flatMap((id) => lower(names.labelName(id)) ?? []);
    case 'epic':
    case 'parent':
      return card.parentId ? lower(names.issueKey(card.parentId)) : [];
    case 'estimate':
      return card.estimate === null ? [] : [card.estimate];
    case 'due':
      return card.dueAt ? [Date.parse(card.dueAt)] : [];
    case 'text':
      return lower(card.title);
    default:
      return null;
  }
}

function literal(value: Value, names: RuleNames): string | number | null {
  switch (value.kind) {
    case 'string':
      return value.value.toLowerCase();
    case 'number':
      return value.value;
    case 'date':
      return Date.parse(value.value);
    case 'duration':
      return Date.now() + value.amount * UNIT[value.unit];
    case 'me':
      return names.meId ? (names.userName(names.meId)?.toLowerCase() ?? null) : null;
    case 'function':
      return value.name === 'now' ? Date.now() : null;
  }
}

function compare(actual: string | number, operator: string, expected: string | number) {
  switch (operator) {
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '~':
      return String(actual).includes(String(expected));
    case '!~':
      return !String(actual).includes(String(expected));
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    default:
      return actual >= expected;
  }
}

/** True, false, or null when the card does not carry a field the expression needs. */
function test(expression: Expression, card: ViewCard, names: RuleNames): boolean | null {
  switch (expression.kind) {
    case 'and':
    case 'or': {
      const results = expression.operands.map((operand) => test(operand, card, names));
      if (results.includes(null)) return null;
      return expression.kind === 'and' ? results.every(Boolean) : results.some(Boolean);
    }
    case 'not': {
      const inner = test(expression.operand, card, names);
      return inner === null ? null : !inner;
    }
    default: {
      const field = catalog.resolve(expression.field.name)?.key ?? expression.field.name;
      const actual = valuesOf(field, card, names);
      if (actual === null) return null;
      if (expression.kind === 'empty') return expression.negated === actual.length > 0;
      if (expression.kind === 'membership') {
        const wanted = expression.values.map((value) => literal(value, names));
        const hit = actual.some((value) => wanted.includes(value));
        return expression.operator === 'IN' ? hit : !hit;
      }
      const expected = literal(expression.value, names);
      if (expected === null) return false;
      const negative = expression.operator === '!=' || expression.operator === '!~';
      return negative
        ? actual.every((value) => compare(value, expression.operator, expected))
        : actual.some((value) => compare(value, expression.operator, expected));
    }
  }
}

/** The colour of the first rule a card matches, or null; rules that do not parse are skipped. */
export function compileColorRules(
  rules: readonly CardColorRuleEntry[],
  names: RuleNames,
): (card: ViewCard) => string | null {
  const compiled = rules.flatMap((rule) => {
    const parsed = parseLql(rule.query);
    if (!parsed.ok || validateLql(parsed.value, catalog).length > 0) return [];
    const where = parsed.value.where;
    return where ? [{ where, color: rule.color }] : [];
  });
  if (compiled.length === 0) return () => null;
  return (card) => compiled.find((rule) => test(rule.where, card, names) === true)?.color ?? null;
}
