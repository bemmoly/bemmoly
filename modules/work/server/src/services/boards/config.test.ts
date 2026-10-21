import { ValidationError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import {
  boardConfigSchema,
  boardViewQuerySchema,
  type BoardConfig,
} from '../../../../shared/boards.ts';
import { configProblems, configQueries, onlyWipChanged, rejectProblems } from './config.ts';

const config = (overrides: Partial<BoardConfig> = {}): BoardConfig =>
  boardConfigSchema.parse({
    columns: [
      { id: 'todo', name: 'To do', statusIds: ['00000000-0000-7000-8000-000000000001'] },
      {
        id: 'done',
        name: 'Done',
        statusIds: ['00000000-0000-7000-8000-000000000002'],
        done: true,
      },
    ],
    ...overrides,
  });

const ALLOWED = new Set([
  '00000000-0000-7000-8000-000000000001',
  '00000000-0000-7000-8000-000000000002',
]);

describe('configProblems', () => {
  it('accepts columns that map the workflow once each', () => {
    expect(configProblems(config(), ALLOWED)).toEqual([]);
  });

  it('names a status outside the workflow, a status shown twice and a repeated column id', () => {
    const base = config();
    const bad: BoardConfig = {
      ...base,
      columns: [
        ...base.columns,
        {
          id: 'todo',
          name: 'Again',
          statusIds: [
            '00000000-0000-7000-8000-000000000001',
            '00000000-0000-7000-8000-000000000009',
          ],
          wipLimit: null,
          done: false,
        },
      ],
    };
    expect(configProblems(bad, ALLOWED)).toEqual([
      { path: 'columns.2.id', message: 'Two columns use "todo"' },
      { path: 'columns.2.statusIds', message: 'Again maps a status that To do already shows' },
      {
        path: 'columns.2.statusIds',
        message: "Again maps a status that is not in this board's workflow",
      },
    ]);
    expect(() => rejectProblems(configProblems(bad, ALLOWED))).toThrow(ValidationError);
  });
});

describe('configQueries', () => {
  it('lists every lane query, quick filter and colour rule with its path', () => {
    const withQueries = config({
      lanes: {
        kind: 'query',
        queries: [{ name: 'Urgent', query: 'priority = highest' }],
        showEmpty: false,
        collapsible: true,
        totals: true,
      },
      quickFilters: [{ name: 'Mine', query: 'assignee = me' }],
      colorRules: [{ query: 'type = Bug', color: '#d93838' }],
    });
    expect(configQueries(withQueries)).toEqual([
      { path: 'lanes.queries.0.query', query: 'priority = highest' },
      { path: 'quickFilters.0.query', query: 'assignee = me' },
      { path: 'colorRules.0.query', query: 'type = Bug' },
    ]);
  });
});

describe('onlyWipChanged', () => {
  it('is true for a WIP limit edit and false for anything more', () => {
    const before = config();
    const wip = {
      ...before,
      columns: before.columns.map((column) => ({ ...column, wipLimit: 3 })),
    };
    expect(onlyWipChanged(before, wip)).toBe(true);
    expect(onlyWipChanged(before, { ...wip, cadenceDays: 7 })).toBe(false);
    expect(onlyWipChanged(before, { ...before, columns: before.columns.slice(0, 1) })).toBe(false);
  });
});

describe('board view query', () => {
  it('takes no card layout from the person asking', () => {
    expect(
      boardViewQuerySchema.parse({ q: 'type = Bug', fields: 'key,labels', density: 'compact' }),
    ).toEqual({ q: 'type = Bug' });
  });

  it('counts a card layout change as more than WIP limits', () => {
    expect(onlyWipChanged(config(), config({ cardFields: ['type'] }))).toBe(false);
    expect(onlyWipChanged(config(), config({ colorRule: 'priority' }))).toBe(false);
  });
});

describe('configQueries for the backlog', () => {
  it('checks backlog filters, match rules and field rules as LQL with their paths', () => {
    const queries = configQueries(
      config({
        backlog: {
          filters: [{ name: 'Support', query: 'type = Support' }],
          sortRules: [
            { kind: 'match', name: 'Bugs', query: 'type = Bug' },
            { kind: 'field', field: 'cf.severity', direction: 'desc' },
          ],
        },
      }),
    );
    expect(queries).toEqual([
      { path: 'backlog.filters.0.query', query: 'type = Support' },
      { path: 'backlog.sortRules.0.query', query: 'type = Bug' },
      { path: 'backlog.sortRules.1.field', query: 'ORDER BY cf.severity DESC' },
    ]);
  });
});
