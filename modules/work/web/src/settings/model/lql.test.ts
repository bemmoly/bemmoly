import type { Field } from '@bemmoly/module-work/shared';
import { autocompleteLql } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { boardConfig } from './fixtures.ts';
import { checkLql, configLqlProblems, settingsCatalog } from './lql.ts';

const field = (key: string, name: string, kind: Field['kind'], options: string[] = []): Field => ({
  id: '00000000-0000-7000-8000-000000000099',
  projectId: null,
  originId: null,
  key,
  name,
  kind,
  options: options.map((label) => ({ value: label.toLowerCase(), label })),
  filterable: true,
  aiFill: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const catalog = settingsCatalog([
  field('team', 'Team', 'select', ['Platform', 'Billing']),
  field('spec_doc', 'Spec doc', 'doc'),
]);

describe('settings LQL', () => {
  it('accepts the issue fields and the project custom fields', () => {
    expect(checkLql('priority = Highest', catalog)).toBeNull();
    expect(checkLql('type = Bug AND label = customer', catalog)).toBeNull();
    expect(checkLql('cf.team = Platform', catalog)).toBeNull();
    expect(checkLql('"Spec doc" IS EMPTY', catalog)).toBeNull();
  });

  it('positions a parse error and names an unknown field', () => {
    expect(checkLql('priority =', catalog)).toMatchObject({ position: 10 });
    expect(checkLql('colour = red', catalog)).toMatchObject({
      message: 'Unknown field "colour"',
      position: 0,
      length: 6,
    });
    expect(checkLql('  ', catalog)?.message).toBe('Write a query');
  });

  it('lists every bad query of a config with its path', () => {
    const config = boardConfig({
      quickFilters: [
        { name: 'Mine', query: 'assignee = me' },
        { name: 'Broken', query: 'assignee ==' },
      ],
      colorRules: [{ query: 'nope = 1', color: '#d93838' }],
    });
    expect(configLqlProblems(config, catalog).map((problem) => problem.path)).toEqual([
      'quickFilters.1.query',
      'colorRules.0.query',
    ]);
  });

  it('completes custom fields by key and priorities by option', () => {
    const fields = autocompleteLql('cf.t', 4, catalog).suggestions.map((s) => s.label);
    expect(fields).toContain('cf.team');
    const values = autocompleteLql('priority = Hi', 13, catalog).suggestions.map((s) => s.label);
    expect(values).toEqual(['Highest', 'High']);
  });
});
