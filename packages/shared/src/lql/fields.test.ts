import { describe, expect, it } from 'vitest';
import { createIssueFieldCatalog, customField, ISSUE_FIELDS } from './fields.ts';

describe('issue field catalog', () => {
  it('lists every column the board and backlog filter on', () => {
    expect(ISSUE_FIELDS.map((field) => field.key)).toEqual([
      'project',
      'key',
      'type',
      'status',
      'statusCategory',
      'priority',
      'assignee',
      'reporter',
      'parent',
      'epic',
      'sprint',
      'estimate',
      'due',
      'created',
      'updated',
      'fixVersion',
      'label',
      'text',
    ]);
  });

  it('resolves a field by key or label, ignoring case', () => {
    const catalog = createIssueFieldCatalog();
    expect(catalog.resolve('statuscategory')?.key).toBe('statusCategory');
    expect(catalog.resolve('Fix version')?.key).toBe('fixVersion');
    expect(catalog.resolve('summary')).toBeUndefined();
  });

  it('exposes custom fields as cf.<key> and by their label', () => {
    const catalog = createIssueFieldCatalog([
      { key: 'spec_doc', label: 'Spec doc', kind: 'text' },
      { key: 'team', label: 'Team', kind: 'option' },
    ]);
    expect(catalog.resolve('cf.spec_doc')).toMatchObject({ key: 'cf.spec_doc', kind: 'text' });
    expect(catalog.resolve('spec doc')?.key).toBe('cf.spec_doc');
    expect(catalog.resolve('spec_doc')).toBeUndefined();
    expect(catalog.fields.map((field) => field.key)).toContain('cf.team');
  });

  it('keeps a built-in field when a custom field borrows its name', () => {
    const catalog = createIssueFieldCatalog([{ key: 'status', label: 'Status', kind: 'text' }]);
    expect(catalog.resolve('status')?.key).toBe('status');
    expect(catalog.resolve('cf.status')?.kind).toBe('text');
  });

  it('gives a custom select its own value provider unless its options are fixed', () => {
    expect(customField({ key: 'team', label: 'Team', kind: 'option' }).values).toBe('cf.team');
    expect(
      customField({ key: 'size', label: 'Size', kind: 'option', options: ['S', 'M'] }).values,
    ).toBeUndefined();
  });

  it('narrows operators where a kind would allow too much', () => {
    const catalog = createIssueFieldCatalog();
    expect(catalog.resolve('text')?.operators).toEqual(['~', '!~']);
    expect(catalog.resolve('project')?.operators).toEqual(['=', '!=', 'IN', 'NOT IN']);
    expect(catalog.resolve('sprint')?.functions).toEqual(['currentSprint']);
  });
});
