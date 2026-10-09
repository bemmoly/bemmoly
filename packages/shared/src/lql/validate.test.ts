import { describe, expect, it } from 'vitest';
import type { LqlError } from './errors.ts';
import { createIssueFieldCatalog } from './fields.ts';
import { parseLql } from './parser.ts';
import { validateLql } from './validate.ts';

const catalog = createIssueFieldCatalog([
  { key: 'spec_doc', label: 'Spec doc', kind: 'text' },
  { key: 'size', label: 'Size', kind: 'option', options: ['S', 'M', 'L'] },
]);

function validate(text: string): LqlError[] {
  const result = parseLql(text);
  if (!result.ok) throw new Error(result.error.message);
  return validateLql(result.value, catalog);
}

describe('validateLql', () => {
  it.each([
    'project = PLT AND status != Done AND assignee = me AND "spec doc" IS EMPTY ORDER BY updated DESC',
    'priority = Highest',
    'type = Bug AND label = customer',
    'label = tech-debt',
    'sprint = currentSprint() AND assignee IN (me, "Lena K")',
    'due <= endOfWeek() AND created > -7d AND updated >= 2026-01-01',
    'estimate > 3 AND estimate NOT IN (5, 8)',
    'statusCategory = IN_PROGRESS AND cf.size IN (s, L) AND text ~ "login page"',
    'parent IS EMPTY AND NOT (epic = PLT-1 OR fixVersion = "1.2")',
  ])('accepts %s', (text) => {
    expect(validate(text)).toEqual([]);
  });

  it('points at an unknown field and offers the catalog', () => {
    const [error] = validate('status = Done AND summary ~ login');
    expect(error).toMatchObject({ message: 'Unknown field "summary"', position: 18, length: 7 });
    expect(error?.expected).toContain('cf.spec_doc');
  });

  it('rejects an operator the field does not take', () => {
    expect(validate('status ~ Done')).toMatchObject([
      {
        message: 'Status does not support ~',
        position: 0,
        length: 13,
        expected: ['=', '!=', 'IN', 'NOT IN'],
      },
    ]);
    expect(validate('text = login')).toMatchObject([{ message: 'Text does not support =' }]);
    expect(validate('priority IS EMPTY')).toMatchObject([
      { message: 'Priority does not support IS EMPTY' },
    ]);
  });

  it.each([
    ['estimate > many', 'Estimate needs a number, not "many"', 11, 4],
    ['due < soon', 'Due needs a date such as 2026-01-31 or -7d, not "soon"', 6, 4],
    ['priority = Urgent', '"Urgent" is not a priority', 11, 6],
    ['status = me', 'Status is not a person, so "me" has no meaning here', 9, 2],
    ['due = currentSprint()', 'Due does not take currentSprint()', 6, 15],
    ['sprint = now()', 'Sprint does not take now()', 9, 5],
    ['assignee = 7', 'Assignee needs text, not 7', 11, 1],
  ])('rejects %s at the value', (text, message, position, length) => {
    expect(validate(text)).toEqual([expect.objectContaining({ message, position, length })]);
  });

  it('accepts a quoted date for a date field', () => {
    expect(validate('due = "2026-01-31"')).toEqual([]);
  });

  it('checks every value in a list and every sort key', () => {
    const errors = validate('priority IN (High, Urgent, Later) ORDER BY rank');
    expect(errors.map((error) => error.message)).toEqual([
      '"Urgent" is not a priority',
      '"Later" is not a priority',
      'Unknown field "rank"',
    ]);
  });
});
