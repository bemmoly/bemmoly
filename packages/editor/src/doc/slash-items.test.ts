import { describe, expect, it, vi } from 'vitest';
import type { DocServices } from './services.ts';
import { docSlashItems, filterSlashItems } from './slash-items.ts';

const labels = (query: string, ai = true) =>
  filterSlashItems(docSlashItems(ai ? { ai: { run: vi.fn() } } : {}), query).map(
    (item) => `${item.group}: ${item.label}`,
  );

describe('the / menu rows', () => {
  it('lists the AI group first, then the blocks in the mock order', () => {
    expect(labels('').slice(0, 7)).toEqual([
      'AI: Continue writing',
      'AI: Summarize open questions from comments',
      'AI: Create issues from this section',
      'AI: Check consistency with linked issues',
      'Blocks: Issue table from filter',
      'Blocks: Decision',
      'Blocks: Code block',
    ]);
  });

  it('keeps each group together and puts label matches before word matches', () => {
    expect(labels('table')).toEqual([
      'Blocks: Table',
      'Blocks: Table of contents',
      'Blocks: Issue table from filter',
    ]);
    const c = labels('c');
    expect(c.slice(0, 2)).toEqual(['AI: Continue writing', 'AI: Create issues from this section']);
    expect(c.findIndex((row) => row.startsWith('Blocks'))).toBeGreaterThan(
      c.findLastIndex((row) => row.startsWith('AI')),
    );
  });

  it('finds blocks by keyword', () => {
    expect(labels('todo', false)).toEqual(['Blocks: To-do list']);
    expect(labels('hr', false)).toEqual(['Blocks: Divider']);
    expect(labels('h3', false)).toEqual(['Blocks: Subheading']);
  });

  it('hides rows whose service the host has not lent', () => {
    const ids = (services: DocServices) => docSlashItems(services).map((item) => item.id);
    expect(ids({})).not.toContain('pageLink');
    expect(ids({})).not.toContain('continue');
    const search = vi.fn(async () => []);
    expect(ids({ searchPages: search, searchPeople: search, searchIssues: search })).toEqual(
      expect.arrayContaining(['pageLink', 'mention', 'issueEmbed']),
    );
  });
});
