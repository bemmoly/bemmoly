import { describe, expect, it } from 'vitest';
import { autocompleteLql, type LqlCompletion } from './autocomplete.ts';
import { createIssueFieldCatalog } from './fields.ts';

const catalog = createIssueFieldCatalog([{ key: 'spec_doc', label: 'Spec doc', kind: 'text' }]);

/** Completes at the end of the text unless a `|` marks the cursor. */
function complete(text: string): LqlCompletion {
  const cursor = text.indexOf('|');
  return cursor < 0
    ? autocompleteLql(text, text.length, catalog)
    : autocompleteLql(text.slice(0, cursor) + text.slice(cursor + 1), cursor, catalog);
}

function texts(text: string): string[] {
  return complete(text).suggestions.map((suggestion) => suggestion.text);
}

describe('autocompleteLql', () => {
  it('offers fields at the start and filters them by the word being typed', () => {
    expect(texts('')).toEqual([...catalog.fields.map((field) => field.key), 'NOT', '(']);
    expect(complete('sta')).toMatchObject({
      prefix: 'sta',
      replace: { position: 0, length: 3 },
      suggestions: [
        { kind: 'field', text: 'status', detail: 'Status' },
        { kind: 'field', text: 'statusCategory', detail: 'Status category' },
      ],
    });
  });

  it('matches a field by its label too, so a custom field is found by name', () => {
    expect(texts('spec')).toEqual(['cf.spec_doc']);
  });

  it('offers only the operators the field takes', () => {
    expect(texts('status ')).toEqual(['=', '!=', 'IN', 'NOT IN']);
    expect(texts('text ')).toEqual(['~', '!~']);
    expect(texts('assignee !')).toEqual(['!=']);
  });

  it('offers every operator for a field it does not know', () => {
    expect(texts('mystery ')).toContain('IS NOT EMPTY');
  });

  it('names the provider for values that live in the module', () => {
    expect(complete('assignee = ')).toMatchObject({
      suggestions: [
        { kind: 'value', text: 'me' },
        { kind: 'keyword', text: 'EMPTY' },
      ],
      values: { field: { key: 'assignee' }, provider: 'users' },
    });
    expect(complete('status IN (Done, ')).toMatchObject({
      suggestions: [],
      values: { provider: 'statuses' },
    });
  });

  it('completes fixed options, functions and the empty marker', () => {
    expect(texts('priority = h')).toEqual(['Highest', 'High']);
    expect(texts('statusCategory = ')).toEqual(['todo', 'in_progress', 'done']);
    expect(texts('due < ')).toEqual([
      'now()',
      'startOfDay()',
      'endOfDay()',
      'startOfWeek()',
      'endOfWeek()',
      'startOfMonth()',
      'endOfMonth()',
    ]);
    expect(texts('due < start')).toEqual(['startOfDay()', 'startOfWeek()', 'startOfMonth()']);
    expect(texts('sprint = cur')).toEqual(['currentSprint()']);
    expect(texts('priority = ')).not.toContain('EMPTY');
    expect(texts('due < ')).not.toContain('EMPTY');
    expect(texts('due IN (')).not.toContain('EMPTY');
  });

  it('completes inside an open quote and replaces the quote with the choice', () => {
    expect(complete('status = "In r')).toMatchObject({
      prefix: 'In r',
      replace: { position: 9, length: 5 },
      values: { provider: 'statuses' },
    });
  });

  it('walks the rest of the grammar', () => {
    expect(texts('assignee IS ')).toEqual(['EMPTY', 'NOT EMPTY']);
    expect(texts('assignee IS NOT ')).toEqual(['EMPTY']);
    expect(texts('status NOT ')).toEqual(['IN']);
    expect(texts('status IN ')).toEqual(['(']);
    expect(texts('status IN (Done ')).toEqual([',', ')']);
    expect(texts('status = Done ')).toEqual(['AND', 'OR', 'ORDER BY']);
    expect(texts('(status = Done ')).toEqual(['AND', 'OR', 'ORDER BY', ')']);
    expect(texts('status = Done o')).toEqual(['OR', 'ORDER BY']);
    expect(texts('status = Done ORDER ')).toEqual(['BY']);
    expect(texts('status = Done ORDER BY up')).toEqual(['updated']);
    expect(texts('ORDER BY updated ')).toEqual(['ASC', 'DESC', ',']);
    expect(texts('ORDER BY updated DESC')).toEqual(['DESC']);
    expect(texts('ORDER BY updated DESC ')).toEqual([',']);
  });

  it('offers nothing after text it cannot place', () => {
    expect(texts('status = = ')).toEqual([]);
    expect(texts('status = Done # ')).toEqual([]);
  });

  it('completes at a cursor in the middle of the text', () => {
    expect(complete('ass| = me')).toMatchObject({
      prefix: 'ass',
      replace: { position: 0, length: 3 },
      suggestions: [{ text: 'assignee' }],
    });
  });
});
