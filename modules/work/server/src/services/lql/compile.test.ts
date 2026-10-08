import { parseLql, validateLql, type Query } from '@bemmoly/shared';
import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { catalogOf } from './catalog.ts';
import { compileQuery, compileWhere, type CompileCatalog } from './compile.ts';
import { render, unitSql } from './render.test-helper.ts';

const sql = unitSql();
const NOW = new Date('2026-10-08T10:30:00.000Z');
const ME = '0199c0de-0000-7000-8000-000000000001';
const cx = { sql, actorUserId: ME, now: NOW };

const catalog: CompileCatalog = catalogOf([
  { key: 'points', label: 'Points', kind: 'number', storage: 'number' },
  { key: 'spec_doc', label: 'Spec doc', kind: 'text', storage: 'doc' },
  { key: 'owner', label: 'Owner', kind: 'user', storage: 'user' },
  { key: 'review_by', label: 'Review by', kind: 'date', storage: 'date' },
  { key: 'tags', label: 'Tags', kind: 'option', storage: 'multiselect', options: ['a', 'b'] },
  { key: 'tier', label: 'Tier', kind: 'option', storage: 'select', options: ['gold'] },
]);

function parse(text: string): Query {
  const result = parseLql(text);
  if (!result.ok) throw new Error(result.error.message);
  expect(validateLql(result.value, catalog)).toEqual([]);
  return result.value;
}

const where = (text: string) => render(compileWhere(sql, parse(text), catalog, cx));

describe('LQL compiler: operators', () => {
  it('compiles every comparison operator with the value as a parameter', () => {
    expect(where('estimate = 3')).toEqual({
      text: '(issues.estimate = $1::numeric)',
      params: [3],
    });
    expect(where('estimate != 3').text).toContain('is distinct from $1::numeric');
    expect(where('estimate < 3').text).toContain('issues.estimate < $1::numeric');
    expect(where('estimate <= 3').text).toContain('issues.estimate <= $1::numeric');
    expect(where('estimate > 3').text).toContain('issues.estimate > $1::numeric');
    expect(where('estimate >= 3').text).toContain('issues.estimate >= $1::numeric');
  });

  it('compiles IN and NOT IN to array parameters', () => {
    expect(where('estimate IN (1, 2)')).toEqual({
      text: '(issues.estimate = any($1::numeric[]))',
      params: [[1, 2]],
    });
    expect(where('estimate NOT IN (1, 2)').text).toContain('<> all($1::numeric[])');
  });

  it('compiles IS EMPTY and IS NOT EMPTY as null checks', () => {
    expect(where('assignee IS EMPTY').text).toBe('(issues.assignee_id is null)');
    expect(where('assignee IS NOT EMPTY').text).toBe('(issues.assignee_id is not null)');
  });

  it('compiles ~ and !~ as escaped ILIKE patterns', () => {
    expect(where('text ~ "50% off_"')).toEqual({
      text: "(concat_ws(' ', issues.key, issues.title, issues.description_text) ilike $1)",
      params: ['%50\\% off\\_%'],
    });
    expect(where('text !~ login').text).toContain('not ilike $1');
  });

  it('keeps AND, OR and NOT precedence with explicit parentheses', () => {
    const { text } = where('NOT estimate = 1 AND (estimate = 2 OR estimate = 3)');
    expect(text).toBe(
      '(not (issues.estimate = $1::numeric) and ((issues.estimate = $2::numeric) or (issues.estimate = $3::numeric)))',
    );
  });
});

describe('LQL compiler: fields', () => {
  it('resolves status and type names through subqueries', () => {
    expect(where('status = "In Progress"')).toEqual({
      text: '(issues.status_id in (select id from workflow_statuses where lower(name) = any($1::text[])))',
      params: [['in progress']],
    });
    expect(where('type IN (bug, Story)').params).toEqual([
      ['bug', 'story'],
      ['bug', 'story'],
    ]);
    expect(where('statusCategory = done').text).toContain('where category = any($1::text[])');
  });

  it('binds me to the actor and names to the users table', () => {
    const { text, params } = where('assignee IN (me, "ana@acme.test")');
    expect(text).toContain('issues.assignee_id in (select id from users');
    expect(params).toEqual([[ME], ['ana@acme.test'], ['ana@acme.test']]);
  });

  it('rejects me for a system actor', () => {
    expect(() =>
      compileWhere(sql, parse('assignee = me'), catalog, { ...cx, actorUserId: null }),
    ).toThrow(ValidationError);
  });

  it('matches labels through issue_labels', () => {
    expect(where('label = backend').text).toContain(
      'exists (select 1 from issue_labels il join labels l on l.id = il.label_id',
    );
    expect(where('label IS EMPTY').text).toContain('not exists (select 1 from issue_labels il');
  });

  it('resolves currentSprint() to the active sprint of the issue project', () => {
    const { text, params } = where('sprint = currentSprint()');
    expect(text).toContain("state = 'active' and project_id = issues.project_id");
    expect(params).toEqual([]);
    expect(where('fixVersion = "1.2"').text).toContain('select id from versions');
  });

  it('upper-cases keys and project keys', () => {
    expect(where('project = plt').params).toEqual([['PLT']]);
    expect(where('key IN (plt-1, PLT-2)').params).toEqual([['PLT-1', 'PLT-2']]);
    expect(where('parent = PLT-9').text).toContain('issues.parent_id in (select id from issues');
    expect(where('epic = PLT-9').text).toContain("t.level = 'epic'");
  });

  it('orders priorities lowest first so > means more urgent', () => {
    const { text, params } = where('priority > High');
    expect(text).toContain('array_position($1::text[], issues.priority) > array_position(');
    expect(params[0]).toEqual(['lowest', 'low', 'medium', 'high', 'highest']);
    expect(params[2]).toBe('high');
  });

  it('compiles relative dates, date functions and whole days', () => {
    expect(where('updated >= -7d')).toEqual({
      text: '(issues.updated_at >= $1::timestamptz)',
      params: ['2026-10-01T10:30:00.000Z'],
    });
    expect(where('created < startOfWeek()').params).toEqual(['2026-10-05T00:00:00.000Z']);
    expect(where('due = 2026-10-08')).toEqual({
      text: '((issues.due_at)::date = ($1::timestamptz)::date)',
      params: ['2026-10-08T00:00:00.000Z'],
    });
  });
});

describe('LQL compiler: custom fields', () => {
  it('casts the JSONB path by the field kind', () => {
    expect(where('cf.points > 5')).toEqual({
      text: '((issues.custom_fields ->> $1)::numeric > $2::numeric)',
      params: ['points', 5],
    });
    expect(where('"Review by" < 2026-12-01').text).toContain(
      '(issues.custom_fields ->> $1)::timestamptz < $2::timestamptz',
    );
    expect(where('"Spec doc" IS EMPTY')).toEqual({
      text: "(coalesce(issues.custom_fields ->> $1, '') = '')",
      params: ['spec_doc'],
    });
    expect(where('cf.owner = me').params).toEqual(['owner', [ME]]);
    expect(where('cf.tier = gold').text).toContain(
      'lower(issues.custom_fields ->> $1) = lower($2)',
    );
  });

  it('checks multiselect membership by containment', () => {
    const { text, params } = where('cf.tags IN (a, b)');
    expect(text).toContain('jsonb_array_elements_text');
    expect(params).toEqual(['tags', 'tags', ['a', 'b']]);
  });
});

describe('LQL compiler: injection attempts stay parameters', () => {
  it.each([
    'text ~ "\'; drop table issues; --"',
    'status = "\') or 1=1 --"',
    'cf.spec_doc = "$1; select pg_sleep(10)"',
    'assignee = "x\\" or true"',
  ])('never inlines %s', (query) => {
    const { text, params } = where(query);
    expect(text).not.toMatch(/drop|pg_sleep|1=1|or true/i);
    expect(params.flat()).toEqual(expect.arrayContaining([expect.stringMatching(/./)]));
  });

  it('binds a hostile custom field key as the JSONB path parameter', () => {
    const hostile = catalogOf([{ key: "x' or 1=1", label: 'X', kind: 'text', storage: 'text' }]);
    const query = parseLql('"X" = a');
    if (!query.ok) throw new Error(query.error.message);
    const { text, params } = render(compileWhere(sql, query.value, hostile, cx));
    expect(text).not.toContain('1=1');
    expect(params[0]).toBe("x' or 1=1");
  });
});

describe('LQL compiler: ordering', () => {
  it('defaults to rank with the id tiebreak', () => {
    const compiled = compileQuery(sql, parse(''), catalog, cx);
    expect(render(compiled.where).text).toBe('true');
    expect(render(compiled.orderBy).text).toBe(
      'issues.rank asc nulls last, issues.id asc nulls last',
    );
    expect(compiled.directions).toEqual(['ASC', 'ASC']);
  });

  it('follows the query ORDER BY and ties on id in the last direction', () => {
    const compiled = compileQuery(sql, parse('ORDER BY updated DESC, cf.points'), catalog, cx);
    expect(render(compiled.orderBy)).toEqual({
      text: 'issues.updated_at desc nulls last, (issues.custom_fields ->> $1)::numeric asc nulls last, issues.id asc nulls last',
      params: ['points'],
    });
    expect(compiled.directions).toEqual(['DESC', 'ASC', 'ASC']);
  });
});
