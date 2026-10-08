import { describe, expect, it } from 'vitest';
import { formatLql, formatName } from './format.ts';
import { parseLql } from './parser.ts';

function format(text: string): string {
  const result = parseLql(text);
  if (!result.ok) throw new Error(result.error.message);
  return formatLql(result.value);
}

describe('formatLql', () => {
  it.each([
    'project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC',
    'priority = Highest',
    'type = Bug AND label = customer',
    'label = tech-debt',
    'status IN (Done, "In review") AND sprint = currentSprint()',
    'due <= endOfWeek() AND created > -7d AND updated >= 2026-01-31T10:00Z',
    'a = 1 AND (b = 2 OR c = 3)',
    'NOT (a = 1 AND b = 2) OR c = 3',
    'ORDER BY priority, updated DESC',
    '',
  ])('prints %s back unchanged', (text) => {
    expect(format(text)).toBe(text);
  });

  it('normalises spacing, case and the spelling of an empty check', () => {
    expect(
      format('status=Done   and assignee=EMPTY or reporter is not empty order by key asc'),
    ).toBe('status = Done AND assignee IS EMPTY OR reporter IS NOT EMPTY ORDER BY key ASC');
  });

  it('drops parentheses that change nothing and keeps those that do', () => {
    expect(format('(a = 1) AND ((b = 2))')).toBe('a = 1 AND b = 2');
    expect(format('(a = 1 OR b = 2) AND c = 3')).toBe('(a = 1 OR b = 2) AND c = 3');
    expect(format('NOT (a = 1)')).toBe('NOT a = 1');
    expect(format('NOT NOT a = 1')).toBe('NOT NOT a = 1');
  });

  it('quotes only names the tokenizer would not read back as one word', () => {
    expect(formatName('tech-debt')).toBe('tech-debt');
    expect(formatName('cf.spec_doc')).toBe('cf.spec_doc');
    expect(formatName('In review')).toBe('"In review"');
    expect(formatName('and')).toBe('"and"');
    expect(formatName('me')).toBe('"me"');
    expect(formatName('1.2')).toBe('"1.2"');
    expect(formatName('')).toBe('""');
    expect(formatName('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('survives a second round trip', () => {
    const once = format('status="Done" AND (assignee=me OR "spec doc" != EMPTY)');
    expect(format(once)).toBe(once);
  });
});
