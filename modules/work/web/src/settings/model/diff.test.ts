import { describe, expect, it } from 'vitest';
import { addColumn, moveColumn, setWip } from './columns.ts';
import { adoptOrgConfig, boardConfigDiff } from './diff.ts';
import { boardConfig, S, statusName, STATUSES } from './fixtures.ts';
import { mergeSection, onlyWip, sectionDirty } from './sections.ts';

describe('boardConfigDiff', () => {
  it('is empty for equal configs', () => {
    expect(boardConfigDiff(boardConfig(), boardConfig(), statusName)).toEqual([]);
  });

  it('names column changes with status names and the attributes that differ', () => {
    const after = setWip(addColumn(boardConfig()), 'qa', '2');
    const rows = boardConfigDiff(boardConfig(), after, statusName);
    expect(rows).toEqual([
      {
        key: 'columns.qa',
        label: 'Column "QA"',
        change: 'changed',
        before: 'Testing',
        after: 'Testing · WIP 2',
        attributes: ['WIP limit'],
      },
      {
        key: 'columns.new-column',
        label: 'Column "New column"',
        change: 'added',
        after: 'None',
        attributes: [],
      },
    ]);
  });

  it('reports a removed column and a new order', () => {
    const before = boardConfig();
    const after = {
      ...moveColumn(before, 0, 3),
      columns: moveColumn(before, 0, 3).columns.filter((c) => c.id !== 'review'),
    };
    const rows = boardConfigDiff(before, after, statusName);
    expect(rows.map((row) => [row.key, row.change])).toEqual([
      ['columns.review', 'removed'],
      ['columns.order', 'changed'],
    ]);
    expect(rows[0]?.before).toBe('Code review');
  });

  it('lists lane, filter, card and method settings in words', () => {
    const after = boardConfig({
      lanes: {
        kind: 'query',
        queries: [{ name: 'Expedite', query: 'priority = Highest' }],
        showEmpty: false,
        collapsible: true,
        totals: true,
      },
      quickFilters: [{ name: 'Mine', query: 'assignee = me' }],
      cardFields: ['key', 'type'],
      colorRules: [{ query: 'type = Bug', color: '#d93838' }],
      estimationUnit: 'hours',
    });
    const rows = boardConfigDiff(boardConfig(), after, statusName);
    expect(rows.map((row) => [row.label, row.before, row.after])).toEqual([
      ['Default swimlanes', 'None', 'Custom queries'],
      ['Lane "Expedite"', undefined, 'priority = Highest'],
      ['Quick filter "Mine"', undefined, 'assignee = me'],
      [
        'Card fields',
        'Issue type, Issue key, Priority, Labels, Estimate, Assignee',
        'Issue key, Issue type',
      ],
      ['Color rules', 'None', 'type = Bug as #d93838'],
      ['Estimation', 'Story points', 'Hours'],
    ]);
  });
});

describe('adoptOrgConfig', () => {
  it('re-points the org columns at the project statuses by name', () => {
    const orgIds = new Map(STATUSES.map((s, i) => [`org-${i}`, s.name]));
    const org = boardConfig();
    const orgConfig = {
      ...org,
      columns: org.columns.map((column) => ({
        ...column,
        statusIds: column.statusIds.map((id) => `org-${STATUSES.findIndex((s) => s.id === id)}`),
      })),
    };
    const adopted = adoptOrgConfig(orgConfig, (id) => orgIds.get(id) ?? '', STATUSES.slice(0, 5));
    expect(adopted.columns.map((c) => c.statusIds)).toEqual([
      [S['Backlog'], S['Selected']],
      [S['In progress']],
      [S['Code review']],
      [S['Testing']],
      [],
    ]);
  });
});

describe('sections', () => {
  it('saves one tab without the drafts of another', () => {
    const stored = boardConfig();
    const draft = boardConfig({
      estimationUnit: 'hours',
      quickFilters: [{ name: 'Mine', query: 'assignee = me' }],
    });
    const merged = mergeSection('filters', stored, draft);
    expect(merged.quickFilters).toEqual(draft.quickFilters);
    expect(merged.estimationUnit).toBe('points');
    const storedDraft = { config: stored, method: 'scrum' as const };
    expect(sectionDirty('method', storedDraft, { config: draft, method: 'scrum' })).toBe(true);
    expect(sectionDirty('cards', storedDraft, { config: draft, method: 'scrum' })).toBe(false);
    expect(sectionDirty('method', storedDraft, { config: stored, method: 'kanban' })).toBe(true);
  });

  it('knows a WIP-only change', () => {
    expect(onlyWip(boardConfig(), setWip(boardConfig(), 'qa', '3'))).toBe(true);
    expect(onlyWip(boardConfig(), addColumn(boardConfig()))).toBe(false);
  });
});
